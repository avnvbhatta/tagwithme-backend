const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const { pool } = require('./dbConfig')
const bcrypt = require('bcrypt')

const JWTstrategy = require('passport-jwt').Strategy;
//We use this to extract the JWT sent by the user
const ExtractJWT = require('passport-jwt').ExtractJwt;

//Create a passport middleware to handle User login
passport.use('login', new localStrategy({
  usernameField : 'email',
  passwordField : 'password'
}, async (email, password, done) => {
  try {
    //Find the user associated with the email provided by the user
    pool.query(
        `SELECT * FROM users WHERE email = $1`,
        [email],
        (err, results) => {
          if (err) {
            throw err;
          }
  
          //If email exists
          if (results.rows.length > 0) {
              //Get the user
            const user = results.rows[0];

            if( !user ){
                //If the user isn't found in the database, return a message
                return done(null, false, { message : 'User not found'});
            }
  
            //Check if password is correct
            bcrypt.compare(password, user.password, (err, isMatch) => {
              if (err) {
                console.log(err);
              }
              
              //Validate password and make sure it matches with the corresponding hash stored in the database
            //If the passwords match, it returns a value of true.
              if (isMatch) {
                //Send the user information to the next middleware
                return done(null, user, { message : 'Logged in Successfully'});
              } 
              //password is incorrect
              else {
                return done(null, false, { message : 'Wrong Password'});
              }
            });
          } 
          //If not email/user exists
          else {
            return done(null, false, { message : 'No user exists'});
          }
        }
      );
    
  } catch (error) {
    return done(error);
  }
}));



//This verifies that the token sent by the user is valid
passport.use(new JWTstrategy({
  //secret we used to sign our JWT
  secretOrKey : process.env.TOKEN_SECRET,
  //we expect the user to send the token as a query parameter with the name 'secret_token'
  jwtFromRequest : ExtractJWT.fromAuthHeaderAsBearerToken('secret_token')
}, async (token, done) => {
  try {
    //Pass the user details to the next middleware
    return done(null, token.user);
  } catch (error) {
    done(error);
  }
}));
