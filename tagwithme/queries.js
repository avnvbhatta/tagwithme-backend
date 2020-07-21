const { pool } = require('./dbConfig')
const bcrypt = require('bcrypt')

//Get list of users
const getUsers = async (request, response) => {
  try {
    let res = await pool.query('SELECT * FROM users ORDER BY id ASC');
    response.status(200).json(res.rows)

  } catch (error) {
    console.log("error in getUsers", error)
    throw error;
  }
    
}

//Get specific user by ID
const getUserById = async (request, response) => {
    const id = parseInt(request.params.id);
    try {
      let results = await pool.query(
        `SELECT id, name, city, state, imgurl, 
        count(distinct f1.following_id) followerCount,
        count(distinct f2.user_id) followingCount
        FROM users u
        left join follower f1 on (u.id = f1.user_id)
        left join follower f2 on (u.id = f2.following_id) 
        WHERE u.id = $1
        group by id, name, city, state, imgurl`, [id]);
      response.status(200).send(results.rows[0])
    } catch (error) {
      console.log("error in getUserById", error)
      throw error;
    }
    
    
}

//Update specific user by ID
const updateUser = async (request, response) => {
    const id = parseInt(request.params.id);
    const { name, email, password } = request.body;
    try {
      let results =  await pool.query(
        'UPDATE users SET name = $1, email = $2, password=$3 WHERE id = $4',
        [name, email, password, id]);
      response.status(200).send(`User modified with ID: ${id}`)

    } catch (error) {
      console.log("error in updateUser", error)
      throw error;
    }
  
}

//Delete specific user
const deleteUser = async (request, response) => {
    const id = parseInt(request.params.id)
    try {
      let results = await pool.query('DELETE FROM users WHERE id = $1', [id]);
      response.status(200).send(`User deleted with ID: ${id}`)
    } catch (error) {
      console.log("error in deleteUser", error)
      throw error;
    }
    
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

const getInterestedEvents = async (req, res) =>{
  const userId = parseInt(req.params.userId);
  try {
    let results = await pool.query(
      `SELECT id, name, segment, genre, starttime, startdate, images, url, venue, distance, address, city,
       state, lat, lng, parking, pricerange, postalcode, user_id from events e 
       join interested_events ie on (ie.event_id = e.id)
       WHERE user_Id = $1`, 
       [userId]);
    res.status(200).send(results.rows)

  } catch (error) {
      console.log("error in getInterestedEvents", error)
      throw error;
  }
}

const createInterestedEvent = async (req, res) =>{
  const { id, name, segment, genre, startTime, startDate, images, url, venue, distance, address,
    city, state, lat, lng, parking, priceRange, postalCode, userId } = req.body;

    let errors = []
    try {
      let results = await pool.query(
        `INSERT INTO events (id, name, segment, genre, starttime, startdate, images, url, venue, distance, address,city, state, lat, lng, parking, pricerange, postalcode) 
          VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO NOTHING
        `, [id, name, segment, genre, startTime, startDate, images, url, venue, distance, address, city, state, lat, lng, parking, priceRange, postalCode]);

      results = await pool.query(
        `INSERT INTO interested_events(user_id, event_id, timestamp)
          VALUES ($1, $2, now())
          `, [userId, id]);

    } catch (error) {
        console.log("error in createInterestedEvent endpoint", error);
        errors.push(error)
    }
  

  if(errors.length > 0){
    res.status(405).send({error: errors})
  }else{
    res.status(200).send({message: 'Successfully added to tables'})
  }

}


const deleteInterestedEvent = async (req, res) =>{
  const { eventId, userId}  = req.body;
  
     try {
      let results = await pool.query(
        `delete from interested_events where event_id = $1 and user_id = $2 `, 
         [eventId, userId]);
        res.status(200).send({message: 'successfully deleted'})

     } catch (error) {
       console.log('error in deleteInterestedEvent', error)
       throw error;
     }
}


const getGlobalFeedEvents = async (req, res) => {
  const {userId, lat, lng, radius} = req.body;
  try {
    let results = await pool.query(
      `SELECT e.id id, e.name, segment, genre, starttime, startdate, images, url, venue, distance, address, e.city,
       e.state, lat, lng, parking, pricerange, postalcode, u.name userName, timestamp, u.imgurl, u.id userid,
       case when e.id in (select distinct event_id from interested_events where user_id = $4) then true else false end isInterested
       from events e
       JOIN interested_events ie on (ie.event_id = e.id)
       JOIN users u on (ie.user_id = u.id)
       WHERE earth_box(ll_to_earth($1, $2), ($3/0.8) * 10000) @> ll_to_earth(lat, lng) and u.id != $4;
       `, 
       [lat, lng, radius, userId]);

      res.status(200).send(results.rows)

    
  } catch (error) {
      console.log('error in getGlobalFeedEvents', error);
      throw error;
  }
}


const followUser = async (req, res) => {
    const{user_id, following_id} = req.body;
    try {
      let results = pool.query(
        `INSERT INTO follower(user_id, following_id)
          VALUES ($1, $2)
        `, [user_id, following_id]);
        res.status(200).send({message: 'follow successful'})

    } catch (error) {
      console.log('error in followUser', error);
      throw error;
    }
}

const unfollowUser = async (req, res) => {
  const{user_id, following_id} = req.body;
  try {
      let results = await pool.query(
        `DELETE FROM follower WHERE user_id=$1 and following_id=$2`, [user_id, following_id]);
        res.status(200).send({message: 'unfollow successful'})
  } catch (error) {
      console.log('error in unfollowUser', error);
      throw error;
  }
}

const getUserFollowers = async (req, res) => {
    const id = parseInt(req.params.id)
    let followers = [];
    let following = [];
    try {
      let result = await pool.query(
        `select f.following_id id, u.name , u.imgurl  
        From follower f
        join users u on (u.id = f.following_id) 
        where f.user_id = $1`, [id])
        let rows = result.rows;
        following = rows;
    
        result = await pool.query(
          `select f.user_id id, u.name , u.imgurl  
           From follower f
           join users u on (u.id = f.user_id) 
           where f.following_id = $1`, [id])
        rows = result.rows;
        followers = rows;
        
        res.status(200).send({followers, following})
    } catch (error) {
      console.log('error in getUserFollowers', error);
      throw error;
    }
   
}

const uploadProfilePic = async (req, res) => {
  const { filename } = req.file;
  const userid = req.body.userid;

  try {
    let results = await pool.query(
      `UPDATE users SET imgurl = $1 where id = $2
       `, 
       [filename, userid]);
     res.status(200).json({message: "Profile picture was updated", url:filename})
  } catch (error) {
      console.log('error in uploadProfilePic', error);
      throw error;
  }
  
}

const loginStatus = async (req, res) => {
  
  if(!req.isAuthenticated()){
    res.status(401).send({error: 'not authenticated'})
  }
  else{
    let id = req.user.id;
    let followers = [];
    let following = [];
    let result = await pool.query(
    `select f.following_id id, u.name , u.imgurl  
    From follower f
    join users u on (u.id = f.following_id) 
    where f.user_id = $1`, [id])
    let rows = result.rows;
    following = rows;

    result = await pool.query(
      `select f.user_id id, u.name , u.imgurl  
       From follower f
       join users u on (u.id = f.user_id) 
       where f.following_id = $1`, [id])
    rows = result.rows;
    followers = rows;

    let userInfo = {
      isAuthenticated: req.isAuthenticated(),
      userData : {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        imgurl: req.user.imgurl,
        city: req.user.city,
        state: req.user.state,
        followers: followers,
        following: following
      }
    }
    res.status(200).send(userInfo)

  }
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
    uploadProfilePic,
    followUser,
    unfollowUser,
    getUserFollowers
}