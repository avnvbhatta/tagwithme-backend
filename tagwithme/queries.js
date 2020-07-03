const { pool } = require('./dbConfig')
const bcrypt = require('bcrypt')

//Get list of users
const getUsers = (request, response) => {
    pool.query('SELECT * FROM users ORDER BY id ASC', (error, results) => {
      if (error) {
        throw error
      }
      response.status(200).json(results.rows)
    })
}

//Get specific user by ID
const getUserById = (request, response) => {
    const id = parseInt(request.params.id)
    pool.query('SELECT * FROM users WHERE id = $1', [id], (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json(results.rows)
    })
}

//Update specific user by ID
const updateUser = (request, response) => {
    const id = parseInt(request.params.id)
    const { name, email, password } = request.body
  
    pool.query(
      'UPDATE users SET name = $1, email = $2, password=$3 WHERE id = $4',
      [name, email, password, id],
      (error, results) => {
        if (error) {
          throw error
        }
        response.status(200).send(`User modified with ID: ${id}`)
      }
    )
}

//Delete specific user
const deleteUser = (request, response) => {
    const id = parseInt(request.params.id)
  
    pool.query('DELETE FROM users WHERE id = $1', [id], (error, results) => {
      if (error) {
        throw error
      }
      response.status(200).send(`User deleted with ID: ${id}`)
    })
}

//Register user / create user
const register = async (req, res) => {
  const {name, email, password} = req.body;
  let errors = [];
  if(!name || !email || !password){
    errors.push({message: 'Please enter all fields.'})
  }
  if(password.length < 6){
    errors.push({message: 'Password should be at least 6 characters.'})
  }

  if(errors.length > 0 ){
    res.status(400).send(errors)
  }
  else{
    let hashedPassword = await bcrypt.hash(password, 10);
    pool.query(
      `SELECT * FROM users 
        WHERE email = $1`, [email], (err, results) => {
          if(err){
            throw err
          }
          else{
            if(results.rows.length > 0){
              errors.push({message: 'Email already registered.'})
              res.status(400).send(errors)
            }
            else{
              pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *', [name, email, hashedPassword], (error, results) => {
                if (error) {
                  throw error
                }
                res.status(201).send(`User added with ID: ${results.rows[0].id}`)
              })
            }
          }
        }
    )
  }
}

const createInterestedEvent = (req, res) =>{
  // const { id, name, classification, date, images, url, venue, distance, address,
  //   city, state, location, parking, priceRange, postalCode, userId } = req.body;
  //   console.log(id, name, classification.segment, classification.genre, date.startTime, date.startDate, images[0].url, url, venue, distance, address, city.name, state.stateCode, location.longitude+','+location.latitude, parking, priceRange, postalCode, userId);  

  //   pool.query(
  //     `INSERT INTO events (id, name, segment, genre, starttime, startdate, images, url, venue, distance, address,city, state, location, parking, pricerange, postalcode, userid) 
  //       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
  //     `, [id, name, classification.segment, classification.genre, date.startTime, date.startDate, images[0].url, url, venue, distance, address, city.name, state.stateCode, location.longitude+','+location.latitude, parking, priceRange, postalCode, userId], (error, results) =>{
  //       if(error){
  //         throw error;
  //       }
  //       res.status(200).send({message: 'successfully added into events'})
  //     }
  //   )

}


module.exports = {
    getUsers,
    getUserById,
    register,
    updateUser,
    deleteUser,
    createInterestedEvent
}