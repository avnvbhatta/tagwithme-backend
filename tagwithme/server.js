const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const app = express()
const port = 4000
require('dotenv').config()
const db = require('./queries')
const session = require('express-session')
const passport = require('passport')
const initializePassport = require('./passportConfig')
initializePassport(passport);


app.use(cors())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
)

app.use(passport.initialize());
app.use(passport.session());

//middleware to check if request is authenticated
const isAuthenticated = require('./helpers/auth')

/*
* ROUTES-------------------------------------------------------------------------
*/
app.get('/', (request, response) => {
  response.json({ info: 'Node.js, Express, and Postgres API.' })
})

//CRUD Operations
app.get('/users', isAuthenticated, db.getUsers)
app.get('/users/:id', isAuthenticated, db.getUserById)
app.put('/users/:id', isAuthenticated, db.updateUser)
app.delete('/users/:id', isAuthenticated, db.deleteUser)

//Register and Login Operations
app.post('/users/register', db.register);
app.post("/users/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) throw err;
    if (!user) res.status(400).send([{message: "No User Exists"}]);
    else {
      req.logIn(user, (err) => {
        if (err) throw err;
        let userInfo = {
          isAuthenticated: true,
          userData : {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email
          }
        }
        res.send(userInfo);
      });
    }
  })(req, res, next);
});

//Logout from session
app.get('/logout', (req,res)=>{
  req.logOut();
  res.send({message: "Successfully logged out."});
})

//Get login status and send with user info
app.get('/login-status', isAuthenticated, (req, res) => {
  let userInfo = {
    isAuthenticated: true,
    userData : {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    }
  }
  res.status(200).send(userInfo)
});

app.listen(port, () => {
    console.log(`App running on port ${port}.`)
})