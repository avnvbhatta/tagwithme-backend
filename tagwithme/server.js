const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const app = express()
const port = 4000

const db = require('./queries')
const session = require('express-session')
const passport = require('passport')

const initializePassport = require('./passportConfig')
initializePassport(passport);


app.use(cors())
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
)
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (request, response) => {
  response.json({ info: 'Node.js, Express, and Postgres API.' })
})
app.get('/users', db.getUsers)
// app.get('/users/:id', db.getUserById)
// app.post('/users', db.createUser)
// app.put('/users/:id', db.updateUser)
// app.delete('/users/:id', db.deleteUser)



app.post('/users/register', db.registerUser);

app.post('/users/login', passport.authenticate('local', {
  successRedirect: '/success',
  failureRedirect: '/fail'
}));

app.get('/logout', (req,res)=>{
  req.logOut();
  req.send({message: "Successfully logged out."});
  res.redirect("/users/login")
})

app.get('/success',  (req,res)=>{
  res.send({data: {name : req.user.name }})
})
app.get('/fail', (req,res)=>{
  res.send(data)
})





app.listen(port, () => {
    console.log(`App running on port ${port}.`)
})