const express = require('express');
const db = require('../db.js');
const router = express.Router();

const emailer = require('../emails.js');

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
router.post('/mentors/accept/:id/:email', async (req, res) => {

    console.log("user id: " + req.params.id);
    console.log("user email: " + req.params.email);

    const error = await db.acceptMentor(req.params.id);

    //automated email notifying mentor of acceptance
    const acceptanceEmail = {
        from:"peer2peercharlotte@gmail.com",
        to:req.params.email,
        subject:"Welcome to the Peer2Peer team!",
        text:"You have been accepted as a Peer2Peer mentor!"
    }

    await emailer.transporter.sendMail(acceptanceEmail, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log("Email sent: " + info.response);
        }
    });

    if (error === -1) res.redirect('/peerleader/mentors');
    else res.send(error);
});
router.post('/mentors/reject/:id', async (req, res) => {
    const error = await db.rejectMentor(req.params.id);
    if (error == -1) res.redirect('/peerleader/mentors');
    else res.send(error);
});

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

