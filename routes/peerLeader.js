const express = require('express');
const db = require('../db.js');
const router = express.Router();

//Middleware to make sure any peerLeader trying to access the peerLeader pages is logged in
router.use((req, res, next) => {
    if (req.user && req.user.isPeerLeader) next(); //If logged in, continue
    else res.redirect('/'); //If not logged in, send to main page
});

router.get('/', (req, res) => {
    res.render('peerLeader/index.ejs', {
        signedIn: (req.user != null),
        ...req.user
    });
});

router.get('/mentors', async (req, res) => { //When a user accesses /peerleader, display a custom page with ejs
    const mentors = await db.getAllMentors();
    res.render('peerLeader/mentors.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        mentors
    });
});
router.post('/mentors/accept/:id', async (req, res) => {
    const error = await db.acceptMentor(req.params.id);
    if (error == -1) res.redirect('/peerleader/mentors');
    else res.send(error);
});
router.post('/mentors/reject/:id', async (req, res) => {
    const error = await db.rejectMentor(req.params.id);
    if (error == -1) res.redirect('/peerleader/mentors');
    else res.send(error);
});


//TODO Allow peer leaders to mark a session as done

router.get('/sessions', async (req, res) => { //When a user accesses /peerleader, display a custom page with ejs
    const sessions = await db.getSessions('peerLeader', req.user.googleId);
    res.render('peerLeader/sessions.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        sessions
    });
});
router.post('/sessions/accept/:id', async (req, res) => {
    const error = await db.acceptSession(req.params.id, 'peerLeader', req.user.googleId);
    if (error == -1) res.redirect('/peerleader/sessions');
    else res.send(error);
});
router.post('/sessions/reject/:id', async (req, res) => {
    const error = await db.rejectSession(req.params.id, 'peerLeader', req.user.googleId);
    if (error == -1) res.redirect('/peerleader/sessions');
    else res.send(error);
});

module.exports = router; //Allows the router object to be accessed through require()

