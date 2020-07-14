const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const app = express()
const port = 4000
require('dotenv').config()
const db = require('./queries')
const passport = require('passport')
const jwt = require('jsonwebtoken');
app.use(bodyParser.json()); 
app.use( bodyParser.urlencoded({ extended : false }) );
app.use(cors())
require('./auth');




//middleware to check if request is authenticated
 const isValidJWT = passport.authenticate('jwt', { session : false });

/*
* ROUTES-------------------------------------------------------------------------
*/
app.get('/', (request, response) => {
  response.json({ info: 'Node.js, Express, and Postgres API.' })
})

//CRUD Operations
// app.get('/users', isAuthenticated, db.getUsers)
// app.get('/users/:id', isAuthenticated, db.getUserById)
// app.put('/users/:id', isAuthenticated, db.updateUser)
// app.delete('/users/:id', isAuthenticated, db.deleteUser)

/*
* ROUTES-> AUTHENTICATION ROUTES------------------------------------------------------------------------
*/
app.post('/register', db.register);
app.post('/login', async (req, res, next) => {
  passport.authenticate('login', async (err, user, info) => {     try {
      if(err || !user){
        console.log(err)
        const error = new Error('An Error occurred')
        return next(error);
      }
      req.login(user, { session : false }, async (error) => {

        if( error ) return next(error)
        //We don't want to store the sensitive information such as the
        //user password in the token so we pick only the email and id
        const body = { id : user.id, name: user.name, email : user.email };
        //Sign the JWT token and populate the payload with the user email and id
        const token = jwt.sign({ user : body }, process.env.TOKEN_SECRET, {expiresIn: '1d'});
        //Send back the token to the user
        return res.json({ token });
      });     } catch (error) {
      return next(error);
    }
  })(req, res, next);
});

//Get login status and send with user info
app.get('/login-status', isValidJWT, db.loginStatus);


/*
* ROUTES-> EVENT ROUTES------------------------------------------------------------------------
*/

//Interested events
app.get('/get-interested-events/:userId',  isValidJWT, db.getInterestedEvents)
app.post('/create-interested-event', isValidJWT, db.createInterestedEvent)
app.delete('/create-interested-event', isValidJWT, db.deleteInterestedEvent)
app.get('/profile', isValidJWT, db.profile);

//Handle errors
app.use((req, res, next) => {
  res.status(404).send({
  status: 404,
  error: 'Not found'
  })
 })

app.listen(port, () => {
    console.log(`App running on port ${port}.`)
})