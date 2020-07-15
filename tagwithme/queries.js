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

const getInterestedEvents = (req, res) =>{
  const userId = parseInt(req.params.userId)
    pool.query(
      `SELECT id, name, segment, genre, starttime, startdate, images, url, venue, distance, address, city,
       state, lat, lng, parking, pricerange, postalcode, user_id from events e 
       join interested_events ie on (ie.event_id = e.id)
       WHERE user_Id = $1`, 
       [userId], (error, results) =>{
        if(error){
          throw error;
        }
        res.status(200).send(results.rows)
      }
    )
}

const createInterestedEvent = (req, res) =>{
  const { id, name, segment, genre, startTime, startDate, images, url, venue, distance, address,
    city, state, lat, lng, parking, priceRange, postalCode, userId } = req.body;

    let errors = []
  pool.query(
    `INSERT INTO events (id, name, segment, genre, starttime, startdate, images, url, venue, distance, address,city, state, lat, lng, parking, pricerange, postalcode) 
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO NOTHING
    `, [id, name, segment, genre, startTime, startDate, images, url, venue, distance, address, city, state, lat, lng, parking, priceRange, postalCode], (error, results) =>{
      if(error){
        console.log(error)
        errors.push(error)
      }
      
    }
  )

  pool.query(
    `INSERT INTO interested_events(user_id, event_id, timestamp)
      VALUES ($1, $2, now())
      `, [userId, id], (error, results) =>{
      if(error){
        console.log(error)

        errors.push(error)
      }

    }
  )

  if(errors.length > 0){
    res.status(405).send({error: errors})
  }else{
    res.status(200).send({message: 'Successfully added to tables'})
  }

}


const deleteInterestedEvent = (req, res) =>{
  const { eventId, userId}  = req.body;
    pool.query(
      `delete from interested_events where event_id = $1 and user_id = $2 `, 
       [eventId, userId], (error, results) =>{
        if(error){
          throw error;
        }
        res.status(200).send({message: 'successfully deleted'})
      }
    )
}


const getGlobalFeedEvents = (req, res) => {
  const {userId, lat, lng, radius} = req.body;
  pool.query(
    `SELECT e.id id, e.name, segment, genre, starttime, startdate, images, url, venue, distance, address, e.city,
     e.state, lat, lng, parking, pricerange, postalcode, u.name userName, timestamp, u.imgurl,
     case when e.id in (select distinct event_id from interested_events where user_id = $4) then true else false end isInterested
     from events e
     JOIN interested_events ie on (ie.event_id = e.id)
     JOIN users u on (ie.user_id = u.id)
     WHERE earth_box(ll_to_earth($1, $2), ($3/0.8) * 10000) @> ll_to_earth(lat, lng) and u.id != $4;
     `, 
     [lat, lng, radius, userId], (error, results) =>{
      if(error){
        throw error;
      }
      res.status(200).send(results.rows)
    }
  )
}


const uploadProfilePic = (req, res) => {
  const { filename } = req.file;
  const userid = req.body.userid;
  pool.query(
    `UPDATE users SET imgurl = $1 where id = $2
     `, 
     [filename, userid], (error, results) =>{
      if(error){
        throw error;
      }
    }
  )
  return res.status(200).json({message: "Profile picture was updated", url:filename})
}

const loginStatus = (req, res) => {
  let userInfo = {
    isAuthenticated: true,
    userData : {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      city: req.user.city, 
      state: req.user.state, 
      imgurl: req.user.imgurl 
    },
    token : req.query.secret_token
  }
  res.status(200).send(userInfo)
}

const profile = (req, res) => {
  res.status(200).send({
    message : 'You made it to the secure route',
    user : req.user,
    token : req.query.secret_token
  })
}


module.exports = {
    getUsers,
    getUserById,
    register,
    updateUser,
    deleteUser,
    createInterestedEvent,
    getInterestedEvents,
    deleteInterestedEvent,
    getGlobalFeedEvents,
    profile,
    loginStatus,
    uploadProfilePic
}