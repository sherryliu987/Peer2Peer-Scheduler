const express = require('express');
const router = express.Router();

//Middleware to make sure any user trying to access the user pages is logged in
router.use((req, res, next) => {
    if (req.user && req.user.isStudent) next(); //If logged in, continue
    else res.redirect('/'); //If not logged in, send to main page
});

router.get('/', (req, res) => { //When a user accesses /user, display a custom page with ejs
    res.render('student/index.ejs', {
        signedIn: true,
        isStudent: true,
        isMentor: req.user.isMentor,
        appliedMentor: req.user.appliedMentor,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        profileImg: req.user.profileURL,
        grade: req.user.grade,
        state: req.user.state,
        school: req.user.school
    });
});

module.exports = router; //Allows the router object to be accessed through require()
