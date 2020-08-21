const express = require('express');
const db = require('../db.js');
const router = express.Router();

const onPLPage = true;

//Middleware to make sure any peerLeader trying to access the peerLeader pages is logged in
router.use((req, res, next) => {
    if (req.user && req.user.isPeerLeader) next(); //If logged in, continue
    else res.redirect('/'); //If not logged in, send to main page
});

router.get('/', async (req, res) => {
    const sessions = await db.getSessions("peerLeader", req.user.id)
    res.render('peerLeader/index.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        onPLPage,
        sessions
    });
});

router.get('/users', async (req, res) => { //When a user accesses /peerleader, display a custom page with ejs
    const users = await db.getAllUsers();
    res.render('peerLeader/users.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        users,
        onPLPage
    });
});
router.post('/accept/mentor/:id', async (req, res) => {
    const error = await db.acceptUser(req.params.id, 'mentor');
    if (error === -1) res.redirect('/peerleader/users?show=mentors');
    else res.send(error);
});
router.post('/accept/peerLeader/:id', async (req, res) => {
    const error = await db.acceptUser(req.params.id, 'peerLeader');
    if (error === -1) res.redirect('/peerleader/users?show=peerLeaders');
    else res.send(error);
});
router.post('/reject/mentor/:id', async (req, res) => {
    const error = await db.rejectUser(req.params.id, 'mentor');
    if (error === -1) res.redirect('/peerleader/users?show=mentors');
    else res.send(error);
});
router.post('/reject/peerLeader/:id', async (req, res) => {
    const error = await db.rejectUser(req.params.id, 'peerLeader');
    if (error === -1) res.redirect('/peerleader/users?show=peerLeaders');
    else res.send(error);
});

router.get('/sessions', async (req, res) => { //When a user accesses /peerleader, display a custom page with ejs
    const sessions = await db.getSessions('peerLeader', req.user.googleId);
    res.render('peerLeader/sessions.ejs', {
        signedIn: (req.user != null),
        ...req.user,
        sessions,
        onPLPage
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
router.post('/sessions/done/:id', async (req, res) => {
    const error = await db.doneSession(req.params.id, req.user.googleId);
    if (error == -1) res.redirect('/peerleader/sessions');
    else res.send(error);
});
router.post('/sessions/rate/:id', async (req, res) => {
    const possibleRatings = ['1', '2', '3', '4', '5'];
    if (possibleRatings.includes(req.body.mentorRating)) {
        const mentorRating = parseInt(req.body.mentorRating);
        const error = await db.rateSession(req.user.googleId, 'peerLeader', req.params.id, {
            peerLeaderToMentor: mentorRating
        });
        if (error == -1) res.redirect('/peerleader/sessions');
        else res.send(error);
    } else {
        res.send('Please enter a valid rating. Either "1", "2", "3", "4", or "5"');
    }
});


module.exports = router; //Allows the router object to be accessed through require()

