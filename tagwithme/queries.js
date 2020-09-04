const { pool } = require('./dbConfig')
const bcrypt = require('bcrypt')
const socketIo = require('socket.io')
const io = socketIo(4001)

let interval;
let clients = {}
let offlineMessageNotifUsers = {};
let offlineGeneralNotifUsers = {};
io.on('connection', (socket) => {
	console.log('New Client Connected', socket.id);
	socket.on('user_id', function(user_id){
		console.log(`data received is ${user_id}`);
		if(!Object.values(clients).includes(user_id) && user_id != null){
			socket.username = user_id;
			clients[user_id] = socket;
			if(user_id in offlineMessageNotifUsers){
				io.to(clients[user_id].id).emit('FromAPI/newMessageNotification', 'you have new messages');
				delete offlineMessageNotifUsers[user_id];
			}


			if(user_id in offlineGeneralNotifUsers){
				io.to(clients[user_id].id).emit('FromAPI/newGeneralNotification', 'you have new notifications');
				delete offlineGeneralNotifUsers[user_id];
			}
		}

	})

	if(interval){
		clearInterval(interval);
	}

	socket.on('isOnline', function(user_id){
		console.log('is online user_id', user_id);
		if(user_id in clients){
			socket.emit('isOnline', true);
		}
		else{
			socket.emit('isOnline', false);
		}
	})

	socket.on('disconnect', ()=>{
		console.log('client disconnected', socket.username);
		socket.emit('isOnline',  false);
		clearInterval(interval);
		delete clients[socket.username];;	
	});

	console.log('num of online users',Object.values(clients).length)
});


const sendMessage = async(req,res) => {
	req.setTimeout(200);
	const {sender_id, receiver_id, message} = req.body.data;
	try{
		let results = await pool.query(`INSERT INTO chat(sender_id, receiver_id, message, timestamp) 
			VALUES ($1, $2, $3, now() ) returning *
			`,[sender_id, receiver_id, message]);
		try{


			io.to(clients[sender_id].id).emit('FromAPI/message', results.rows[0]);
			if(receiver_id in clients){

				io.to(clients[receiver_id].id).emit('FromAPI/message', results.rows[0]);
				io.to(clients[receiver_id].id).emit('FromAPI/newMessageNotification', sender_id);
			}else{
				offlineMessageNotifUsers[receiver_id] = true;
			}


		}
		catch(error){
			console.log('Client offline');	
			return res.status(200).send('Client offline. Message sent.');
		}
	}
	catch(error){
		console.log('error in sendMessage', error);
		return res.status(500).send('Failed to send message');
	}
	res.status(200).send('Success');
}
 
const getMessages = async(req,res) => {
	const {sender_id, receiver_id} = req.body.data;
	console.log(sender_id, receiver_id);
	try{
		let results = await pool.query(
			`SELECT sender_id, receiver_id, message, timestamp from chat
			where sender_id in ($1,$2) and receiver_id in ($1,$2) order by timestamp asc
			`, [sender_id, receiver_id]);
		res.status(200).send(results.rows);
	}
	catch(error){
		console.log('error in getMessages', error);
		throw error;
	}
	
}

//Get list of users that the user has sent a message too
const getChatUsers = async(req, res) => {
	const {sender_id} = req.body.data;
	try{
		let results = await pool.query(
			`
				select cc.id, cc.name, cc.imgurl, c.message, c.timestamp From chat c
				join (
					select u.id, u.name, u.imgurl, max(message_id)message_id From (
						select receiver_id id, max(message_id) message_id From chat where sender_id = $1  group by receiver_id
						union
						select sender_id id, max(message_id) message_id From chat where receiver_id = $1  group by sender_id
					) temp 
				join users u on (temp.id = u.id)
				group by u.id, u.name, u.imgurl
											
				) cc on (c.message_id = cc.message_id)
				order by timestamp desc
			`

			,[sender_id]);
		res.status(200).send(results.rows);
	}
	catch(error){
		console.log('error in getChatUsers', error);
		throw error;
	}
}
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
    const {id, name, city, state } = request.body;
	console.log(id, name, city, state)
    try {
      let results =  await pool.query(
        'UPDATE users SET name = $1, city = $2, state=$3 WHERE id = $4',
        [name, city, state, id]);
      response.status(200).send(`User modified`)

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
		        `SELECT e.id id, e.name, segment, genre, starttime, startdate, images, url, venue, distance, address, e.city,
		       e.state, lat, lng, parking, pricerange, postalcode, u.name userName, timestamp, u.imgurl, u.id userid,
		      case when e.id in (select distinct event_id from interested_events where user_id = $1) then true else false end isInterested, ie.likes, ie.like_user_id, c.comments 
		       from events e
		       JOIN interested_events ie on (ie.event_id = e.id)
		       JOIN users u on (ie.user_id = u.id)
		       LEFT JOIN (
		      	SELECT user_id, event_id, json_agg(comms) as "comments" 
		       	FROM
		       	(SELECT user_id, event_id, author_id, u.name author_name, u.imgurl author_imgurl, comment, created_at from comments c
		       	join users u on (u.id = c.author_id)
		      	) as comms
		      	GROUP BY user_id, event_id
		     ) c on (ie.user_id = c.user_id and ie.event_id = c.event_id)
		     WHERE u.id = $1 
		     ORDER BY timestamp desc
		  ;`, 
		         [userId]);
	  res.status(200).send(results.rows)

  } catch (error) {
      console.log("error in getInterestedEvents", error)
      throw error;
  }
}

const getInterestedEvent = async (req, res) =>{
  const {user_id, event_id} = req.body;
  try {
    let results = await pool.query(
      `SELECT e.id id, e.name, segment, genre, starttime, startdate, images, url, venue, distance, address, e.city,
       e.state, lat, lng, parking, pricerange, postalcode, u.name userName, timestamp, u.imgurl, u.id userid,
       case when e.id in (select distinct event_id from interested_events where user_id = $1) then true else false end isInterested, ie.likes, ie.like_user_id, c.comments 
       from events e
       JOIN interested_events ie on (ie.event_id = e.id)
       JOIN users u on (ie.user_id = u.id)
       LEFT JOIN (
       	SELECT user_id, event_id, json_agg(comms) as "comments" 
       	FROM
       	(SELECT user_id, event_id, author_id, u.name author_name, u.imgurl author_imgurl, comment, created_at from comments c
       	join users u on (u.id = c.author_id)
       	) as comms
       	GROUP BY user_id, event_id
       ) c on (ie.user_id = c.user_id and ie.event_id = c.event_id)
       WHERE u.id = $1 and ie.event_id=$2;
       `, 
       [user_id, event_id]);
    res.status(200).send(results.rows)

  } catch (error) {
      console.log("error in getInterestedEvent", error)
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
       case when e.id in (select distinct event_id from interested_events where user_id = $4) then true else false end isInterested, ie.likes, ie.like_user_id, c.comments 
       from events e
       JOIN interested_events ie on (ie.event_id = e.id)
       JOIN users u on (ie.user_id = u.id)
       LEFT JOIN (
       	SELECT user_id, event_id, json_agg(comms) as "comments" 
       	FROM
       	(SELECT user_id, event_id, author_id, u.name author_name, u.imgurl author_imgurl, comment, created_at from comments c
       	join users u on (u.id = c.author_id)
       	) as comms
       	GROUP BY user_id, event_id
       ) c on (ie.user_id = c.user_id and ie.event_id = c.event_id)
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
	
	results = pool.query(
	`insert into notifications 
	(type, sender_id, receiver_id, created_at)
	values ('follow', $1, $2, now())`, [user_id, following_id]);
        
	res.status(200).send({message: 'follow successful'})

	if(following_id in clients){

	    clients[following_id].emit('FromAPI/newGeneralNotification', `followed by ${user_id}`);
	}else{
		offlineGeneralNotifUsers[following_id] = true;
	}



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


const addComment = async (req,res) => {
	const {user_id, event_id, author_id, comment} =  req.body;
	try{
		let results = await pool.query(
		
		`
		INSERT INTO comments (user_id, event_id, author_id, comment, created_at)
		VALUES ($1, $2, $3, $4, now())`,[user_id, event_id, author_id, comment]);
		
		results = pool.query(
		`insert into notifications 
		(type, sender_id, receiver_id, event_id, created_at)
		values ('comment', $1, $2, $3, now())`, [author_id, user_id, event_id]);
		

		if(user_id in clients){

		    clients[user_id].emit('FromAPI/newGeneralNotification', `${author_id} commented on your post}`);
		}else{
			offlineGeneralNotifUsers[user_id] = true;
		}
			res.status(200).send('Insert successful');

			
	}
	catch(error){
		console.log('Error in insertComment', error);
		res.status(500).send('Error adding comment');
		throw error;
	}

}


const updateLikes = async (req,res) => {
		
	const {liker_id, user_id, event_id, increment} = req.body;
	try{
		if(increment){
			let results = await pool.query(
			`
			UPDATE interested_events
			SET like_user_id = like_user_id || $1, likes = likes + 1
			WHERE NOT ($1 = ANY (like_user_id))
			AND event_id = $2 and user_id = $3
			`, [liker_id, event_id, user_id]);


			results = pool.query(
			`insert into notifications 
			(type, sender_id, receiver_id, event_id, created_at)
			values ('like', $1, $2, $3, now())`, [liker_id, user_id, event_id]);
			
			//don't send notification to yourself
			if(user_id !== liker_id){

				if(user_id in clients){

			    	clients[user_id].emit('FromAPI/newGeneralNotification', `${liker_id} liked your post}`);
				}else{
					offlineGeneralNotifUsers[user_id] = true;
				}
			}

		}
		else{
			let results = await pool.query(
			`
			UPDATE interested_events
			SET like_user_id = array_remove(like_user_id, $1), likes = likes - 1
			WHERE  ($1 = ANY (like_user_id))
			AND event_id = $2 and user_id = $3
			`, [liker_id, event_id, user_id] );
		}
		res.status(200).send('Like successful');
	}
	catch(error) {
			console.log('Error in updateLikes', error);
			res.status(500).send('Error updating likes');
			throw error;
	}
}
const getNotifications = async (req, res) =>{
	const {user_id} = req.body;
	try{
		let results = await pool.query(
			`
			select u.id sender_id, u.name sender_name, u.imgurl sender_imgurl, 
			n.type, receiver_id, event_id, created_at 
			from notifications n
			join users u on (u.id = n.sender_id)
			where receiver_id = $1 and sender_id !=$1
			order by created_at desc
			`, [user_id]);
		res.status(200).send(results.rows);
		
	}
	catch(error){
		console.log('Error in getNotifications', getNotifications);
		res.status(500).send('Error in getNotifications');
		throw error;
	}
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
    getUserFollowers,
	sendMessage,
	getMessages,
	getChatUsers,
	addComment,
	updateLikes,
	getNotifications,
	getInterestedEvent
}
