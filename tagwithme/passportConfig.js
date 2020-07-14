const LocalStrategy = require('passport-local').Strategy;
const {pool} = require('./dbConfig')
const bcrypt = require('bcrypt')

//Initial login function 
function initialize(passport) {
    const authenticateUser = (email, password, done) => {
      //First check if email exists in the database.
      pool.query(
        `SELECT * FROM users WHERE email = $1`,
        [email],
        (err, results) => {
          if (err) {
            throw err;
          }
  
          //If email exists
          if (results.rows.length > 0) {
            const user = results.rows[0];
  
            //Check if password is correct
            bcrypt.compare(password, user.password, (err, isMatch) => {
              if (err) {
                console.log(err);
              }
              //password matches
              if (isMatch) {
                return done(null, user);
              } 
              //password is incorrect
              else {
                return done(null, false, { message: "Password is incorrect" });
              }
            });
          } 
          //If not email/user exists
          else {
            return done(null, false, {
              message: "No user with that email address"
            });
          }
        }
      );
    };
  
    //Use specified local strategy 
    passport.use(
      new LocalStrategy(
        { usernameField: "email", passwordField: "password" },
        authenticateUser
      )
    );
    // Stores user details inside session. serializeUser determines which data of the user
    // object should be stored in the session. The result of the serializeUser method is attached
    // to the session as req.session.passport.user = {}. Here for instance, it would be (as we provide
    //   the user id as the key) req.session.passport.user = {id: 'xyz'}
    passport.serializeUser((user, done) => done(null, user.id));
  
    // In deserializeUser that key is matched with the in memory array / database or any data resource.
    // The fetched object is attached to the request object as req.user
  
    passport.deserializeUser((id, done) => {
      pool.query(`SELECT * FROM users WHERE id = $1`, [id], (err, results) => {
        if (err) {
          return done(err);
        }
        return done(null, results.rows[0]);
      });
    });
  }
  
  module.exports = initialize;