//Middleware function to check if request is authenticated
function isAuthenticated (req, res, next) {
    if(req.isAuthenticated()){
      return next();
    }
    res.status(403).send({isAuthenticated: false})
}
module.exports = isAuthenticated;