const express = require('express');
const { check, validationResult } = require('express-validator');
const db = require('../db.js');
const router = express.Router();

router.get('/', (req, res) => { //When someone accesses /signup
    if (!req.user) { //If they aren't signed in with google yet
        res.redirect('/');
    } else {
        res.render('signup/index.ejs', {
            isStudent: req.user.isStudent,
            isMentor: req.user.isMentor
        });
    }
});
router.get('/student', (req, res) => { //When someone accesses /signup/student
    if (!req.user || req.user.isStudent) {//If they aren't signed in or are already a student
        res.redirect('/'); 
    } else {
        res.render('signup/student.ejs', {
            values: {
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email
            },
            errors: []
        });
    }
});
router.post('/student', [
    check('firstName').trim().notEmpty(),
    check('lastName').trim().notEmpty(),
    check('email').isEmail().normalizeEmail(),
    check('state').isLength(2)
], async (req, res) => {
    if (!req.user || req.user.isStudent) {
        res.status(401);
    } else {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.render('signup/student.ejs', {
                values: req.body,
                errors: errors.array().map(e => e.param)
            });
            return;
        }
        await db.updateUser(req.user.googleId, {
            isStudent: true,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            grade: req.body.grade,
            state: req.body.state,
        });
        res.redirect('/student');
    }
});


module.exports = router;
