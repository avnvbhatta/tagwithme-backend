const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const app = express()
const port = 4000

const db = require('./queries')
const session = require('express-session')
const passport = require('passport')
const cookieParser = require("cookie-parser");
const initializePassport = require('./passportConfig')
initializePassport(passport);


app.use(cors())
app.use(session({
  secret: 'secret',
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


app.get('/', (request, response) => {
  response.json({ info: 'Node.js, Express, and Postgres API.' })
})

app.get('/users', auth, db.getUsers)
// app.get('/users/:id', db.getUserById)
// app.post('/users', db.createUser)
// app.put('/users/:id', db.updateUser)
// app.delete('/users/:id', db.deleteUser)



app.post('/users/register', db.registerUser);



// Routes
app.post("/users/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) throw err;
    if (!user) res.send("No User Exists");
    else {
      req.logIn(user, (err) => {
        if (err) throw err;
        let userInfo = {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email
        }
        res.send(userInfo);
      });
    }
  })(req, res, next);
});


app.get('/logout', (req,res)=>{
  req.logOut();
  res.send({message: "Successfully logged out."});
})


function auth (req, res, next) {
  if(req.isAuthenticated()){
    return next();
  }
  res.status(403).send({isAuthenticated: false})
}


app.get('/dashboard', auth, (req, res) => {
  res.status(200).send({isAuthenticated: true})
});

app.listen(port, () => {
    console.log(`App running on port ${port}.`)
})