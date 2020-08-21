const ObjectId = require('mongodb').ObjectId;
const emailer = require('./emails.js');
const ejs = require('ejs');
const fs = require('fs');

//Loads all of the files from the emailTemplates directory and stores them in the templates object
let templates = {};
fs.readdirSync('./emailTemplates').forEach(file => {
    const template = fs.readFileSync('./emailTemplates/' + file, 'utf8');
    const fileName = file.split('.')[0];
    templates[fileName] = template;
});

//Fetches a user from the db by their googleId
async function findUser(googleId) {
    try {
        const userCollection = globalDB.collection('users');
        const user = await userCollection.findOne({ googleId });
        return user;
    } catch (err) {
        console.error('Error when finding user.', err);
    }
}

//Addes a user object to the db
async function addUser(userData) {
    try {
        const userCollection = globalDB.collection('users');
        await userCollection.insertOne(userData);
    } catch (err) {
        console.error('Error adding user.', err);
    }
}

//Changes a user's data in the db based on the googleId
async function updateUser(googleId, data) {
    try {
        const userCollection = globalDB.collection('users');
        await userCollection.updateOne({ googleId }, { $set: data });
    } catch (err) {
        console.error('Error updating user.', err);
    }
}

//Adds a session object to the sessions collection
async function addSession(sessionData) {
    const dateObject = new Date(sessionData.dateTime);
    const readableDate = dateObject.toLocaleString();

    for(const ment of sessionData.mentors){
        const emailData = {
            tutorName: ment.name,
            studentName: sessionData.student.name,
            studentGrade: sessionData.student.grade,
            topic: sessionData.subject,
            theDate: readableDate
        };

        const requestEmail = {
            to:ment.email,
            subject:dateObject.toLocaleDateString() + ' New Session Request',
            html: ejs.render(templates.sessionRequest, emailData)
        }
        emailer.transporter.sendMail(requestEmail, error => {
            if (error) {
                console.error('Error when sending mentor request email.', error);
            }
        });
    }
    for(const pl of sessionData.peerLeaders){
        const emailData = {
            plName: pl.name,
            studentName: sessionData.student.name,
            theDate: readableDate
        };
        const requestEmail = {
            to:pl.email,
            subject:dateObject.toLocaleDateString() + ' New Peer Leader Request',
            html: ejs.render(templates.sessionRequestPL, emailData)
        }
        emailer.transporter.sendMail(requestEmail, error => {
            if (error) {
                console.error('Error when sending peer leader request email.', error);
            }
        });
    }

    try {
        const sessionCollection = globalDB.collection('sessions');
        await sessionCollection.insertOne(sessionData);
    } catch (err) {
        console.error('Error adding session.', err);
    }
}

//Sets a session to cancelled when requested by that user
async function cancelSession(sessionId, studentId) {
    try {
        const sessionCollection = globalDB.collection('sessions');
        let objectId;
        try {
            objectId = new ObjectId(sessionId);
        } catch (err) {
            return 'Invalid session id. Session not found.'; //An invalid ObjectId was passed in
        }
        const session = await sessionCollection.findOne({ _id: objectId });
        if (session == null) return 'Session not found.';
        if (session.student.id != studentId) //Make sure the student created that request
            return 'You are not authorized to cancel this session.';

        await sessionCollection.updateOne({ _id: objectId }, { $set: { cancelled: true }});
        const readableDate = new Date(session.dateTime).toLocaleDateString();
        if (session.mentorConfirm && session.mentors.length > 0) {
            const emailData = {
                name: session.mentors[0].name,
                studentName: session.student.name,
                studentGrade: session.student.grade,
                subject: session.subject,
                date: readableDate
            };
            const email = {
                to: session.mentors[0].email,
                subject: readableDate + ' SESSION CANCELLED',
                html: ejs.render(templates.cancellation, emailData)
            }
            emailer.transporter.sendMail(email, error => {
                if (error) {
                    console.error('Error when sending cancellation email to mentor', error);
                }
            });
        }
        if (session.peerLeaderConfirm && session.peerLeaders.length > 0) {
            const emailData = {
                name: session.peerLeaders[0].name,
                studentName: session.student.name,
                studentGrade: session.student.grade,
                subject: session.subject,
                date: readableDate
            };
            const email = {
                to: session.peerLeaders[0].email,
                subject: readableDate + ' SESSION CANCELLED',
                html: ejs.render(templates.cancellation, emailData)
            }
            emailer.transporter.sendMail(email, error => {
                if (error) {
                    console.error('Error when sending cancellation email to peerLeader', error);
                }
            });
        }
        return -1; //-1 means no error
    } catch (err) {
        console.error('Error cancelling session.', err);
        return 'Error cancelling session.';
    }
}

//A peer leader uses this function to accept a mentor or peerLeader applicaiton.
async function acceptUser(userObjectId, type) {
    try {
        const userCollection = globalDB.collection('users');
        let objectId;
        try {
            objectId = new ObjectId(userObjectId);
        } catch (err) {
            return 'User not found.'; //An invalid ObjectId was passed in
        }
        const user = await userCollection.findOne({ _id: objectId });
        if (user == null) return 'User not found.';

        let emailData;
        if (type == 'mentor') {
            if (!user.appliedMentor) return 'That user has not applied to be a mentor.';
            if (user.isMentor) return 'That user is already a mentor.';
            await userCollection.updateOne({ _id: objectId }, { $set: { isMentor: true }});
            emailData = {
                name: user.firstName + ' ' + user.lastName,
                type: 'mentor'
            }
        } else if (type == 'peerLeader') {
            if (!user.appliedPeerLeader) return 'That user has not applied to be a Peer leader.';
            if (user.isPeerLeader) return 'That user is already a Peer Leader.';
            await userCollection.updateOne({ _id: objectId }, { $set: { isPeerLeader: true }});
            emailData = {
                name: user.firstName + ' ' + user.lastName,
                type: 'peer leader'
            }
        } else {
            console.error('An invalid type was passed in. Expected "mentor" or "peerLeader", but got ' + type);
            return 'Something went wrong.';
        }
        //automated email notifying mentor of acceptance
        const acceptanceEmail = {
            to:user.email,
            subject:'Welcome to the Peer2Peer team!',
            html: ejs.render(templates.acceptance, emailData)
        }
        emailer.transporter.sendMail(acceptanceEmail, error => {
            if (error) {
                console.error('Error when sending mentor acceptance email.', error);
            }
        });
        return -1; //-1 means no error
    } catch (err) {
        console.error('Error accepting user.', err);
        return 'Error accepting user.';
    }
}

//A peer leader uses this function to reject a mentor or peerLeader applicaiton.
async function rejectUser(userObjectId, type) {
    try {
        const userCollection = globalDB.collection('users');
        let objectId;
        try {
            objectId = new ObjectId(userObjectId);
        } catch (err) {
            return 'User not found.'; //An invalid ObjectId was passed in
        }
        const user = await userCollection.findOne({ _id: objectId });
        if (user == null) return 'User not found.';

        let emailData;
        if (type == 'mentor') {
            if (!user.appliedMentor) return 'That user has not applied to be a mentor.';
            if (user.isMentor) return 'That user is already a mentor.';
            await userCollection.updateOne({ _id: objectId }, { $set: { appliedMentor: false }});
            emailData = {
                name: user.firstName + ' ' + user.lastName,
                type: 'mentor'
            }
        } else if (type == 'peerLeader') {
            if (!user.appliedPeerLeader) return 'That user has not applied to be a Peer leader.';
            if (user.isPeerLeader) return 'That user is already a Peer Leader.';
            await userCollection.updateOne({ _id: objectId }, { $set: { appliedPeerLeader: false }});
            emailData = {
                name: user.firstName + ' ' + user.lastName,
                type: 'peer leader'
            }
        } else {
            console.error('An invalid type was passed in. Expected "mentor" or "peerLeader", but got ' + type);
            return 'Something went wrong.';
        }
        //automated email notifying mentor of rejection
        const rejectionEmail = {
            to:user.email,
            subject:'Peer2Peer Application',
            html: ejs.render(templates.rejection, emailData)
        }
        emailer.transporter.sendMail(rejectionEmail, error => {
            if (error) {
                console.error('Error when sending rejection email.', error);
            }
        });
        return -1; //-1 means no error
    } catch (err) {
        console.error('Error rejecting user.', err);
        return 'Error rejecting user.';
    }
}

//For a mentor or peer leader, confirms the session
async function doneSession(sessionId, peerLeaderId) {
    try {
        const sessionCollection = globalDB.collection('sessions');
        let objectId;
        try {
            objectId = new ObjectId(sessionId);
        } catch (err) {
            return 'Session not found.'; //An invalid ObjectId was passed in
        }
        const session = await sessionCollection.findOne({ _id: objectId });
        if (session == null) return 'Session not found.';
        if (session.cancelled) return 'Session has been cancelled.';
        if (session.done) return 'Session has already been complete.';
        if (!session.peerLeaderConfirm || session.peerLeaders[0].id != peerLeaderId)
            return 'That user does not have permission to complete this session.';
        await sessionCollection.updateOne({ _id: objectId }, { $set: { done: true }});
        if (session.mentorConfirm) {
            const userCollection = globalDB.collection('users');
            const mentor = await userCollection.findOne({ 'googleId': session.mentors[0].id });
            if (mentor.lastSession < session.dateTime)
                userCollection.updateOne({ 'googleId': session.mentors[0].id }, { $set: { 'lastSession': session.dateTime }});
        }
        return -1; //-1 means no error
    } catch (err) {
        console.error('Error marking session as done.', err);
        return 'Error marking session as done.';
    }
}

//For a mentor or peer leader, confirms the session
async function acceptSession(sessionId, type, googleId) {
    try {
        const sessionCollection = globalDB.collection('sessions');
        let objectId;
        try {
            objectId = new ObjectId(sessionId);
        } catch (err) {
            return 'Session not found.'; //An invalid ObjectId was passed in
        }

        const session = await sessionCollection.findOne({ _id: objectId });
        if (session == null) return 'Session not found.';
        if (session.cancelled) return 'Session has already been cancelled.';
        if (session.done) return 'Session has already been complete.';
        if (type == 'mentor') {
            if (session.mentorConfirm) return 'Session already confirmed.'
            for (let i = 0; i < session.mentors.length; i++) {
                if (session.mentors[i].id == googleId) { //Make sure it is asking this mentor to accept
                    await sessionCollection.updateOne({ _id: objectId }, {
                        $set: {
                            mentorConfirm: true,
                            mentors: [ session.mentors[i] ]
                            //This will remove all other mentors from the list, so only the one who accepted is in it
                        }
                    });
                    break;
                }
            }
        } else if (type == 'peerLeader') {
            if (session.peerLeaderConfirm) return 'Session already confirmed.'
            for (let i = 0; i < session.peerLeaders.length; i++) {
                if (session.peerLeaders[i].id == googleId) { //Make sure it is asking this peerleader to accept
                    await sessionCollection.updateOne({ _id: objectId }, {
                        $set: {
                            peerLeaderConfirm: true,
                            peerLeaders: [ session.peerLeaders[i] ]
                            //This will remove all other peerLeaders from the list, so only the one who accepted is in it
                        }
                    });
                    break;
                }
            }
        } else {
            console.error('Invalid type when accepting session. Expected "mentor" or "peerLeader", but got ' + type);
            return 'Something went wrong. An invalid type was passed in.';
        }

        return -1; //-1 means no error
    } catch (err) {
        console.error('Error cancelling session.', err);
        return 'Error cancelling session.';
    }
}

//For a mentor or peer leader, rejects the sessions. The next best person will be picked
async function rejectSession(sessionId, type, googleId) {
    try {
        const sessionCollection = globalDB.collection('sessions');
        let objectId;
        try {
            objectId = new ObjectId(sessionId);
        } catch (err) {
            return 'Session not found.'; //An invalid ObjectId was passed in
        }
        const session = await sessionCollection.findOne({ _id: objectId });
        if (session == null) return 'Session not found.';
        if (session.cancelled) return 'Session has already been cancelled.';
        if (session.done) return 'Session has already been completed.';
        const readableDate = new Date(session.dateTime).toLocaleDateString();
        if (type == 'mentor') {
            if (session.mentorConfirm) return 'Session already confirmed.'
            let dbUpdates = {
                $pull: { //Removes the mentor from the array
                    'mentors': { 'id': googleId }
                }
            }
            if (session.mentors.length == 1) { //No mentor was available, cancel the session.
                dbUpdates.$set = { cancelled: true };
                if (session.peerLeaderConfirm && session.peerLeaders.length > 0) {
                    const peerleaderEmailData = {
                        name: session.peerLeaders[0].name,
                        studentName: session.student.name,
                        studentGrade: session.student.grade,
                        subject: session.subject,
                        date: readableDate
                    };
                    const plCancellationEmail = {
                        to: session.peerLeaders[0].email,
                        subject: readableDate + ' SESSION CANCELLED',
                        html: ejs.render(templates.cancellation, peerleaderEmailData)
                    }
                    emailer.transporter.sendMail(plCancellationEmail, error => {
                        if (error) {
                            console.error('Error when sending peer leader cancellation email.', error);
                        }
                    });
                }
                const studentEmailData = {
                    name: session.student.name,
                    date: readableDate,
                    subject: session.subject
                }
                const studentCancellationEmail = {
                    to: session.student.email,
                    subject: readableDate + ' SESSION CANCELLED',
                    html: ejs.render(templates.studentCancellation, studentEmailData)
                }
                emailer.transporter.sendMail(studentCancellationEmail, error => {
                    if (error) {
                        console.error('Error when sending student cancellation email.', error);
                    }
                });
            }
            //This removes the first element of the mentors list
            await sessionCollection.updateOne({ _id: objectId }, dbUpdates);
        } else if (type == 'peerLeader') {
            if (session.peerLeaderConfirm) return 'Session already confirmed.'
            let dbUpdates = {
                $pull: { //Removes the peerleader from the array
                    'peerLeaders': { 'id': googleId }
                }
            }
            if (session.peerLeaders.length == 1) { //No peerLeader was available, cancel the session.
                dbUpdates.$set = { cancelled: true };
                if (session.mentorConfirm && session.mentors.length > 0) {
                    const emailData = {
                        name: session.mentors[0].name,
                        studentName: session.student.name,
                        studentGrade: session.student.grade,
                        subject: session.subject,
                        date: readableDate
                    };
                    const email = {
                        to: session.mentors[0].email,
                        subject: readableDate + ' SESSION CANCELLED',
                        html: ejs.render(templates.cancellation, emailData)
                    }
                    emailer.transporter.sendMail(email, error => {
                        if (error) {
                            console.error('Error when sending mentor cancellation email.', error);
                        }
                    });
                }
                const studentEmailData = {
                    name: session.student.name,
                    date: readableDate,
                    subject: session.subject
                }
                const studentCancellationEmail = {
                    to: session.student.email,
                    subject: readableDate + ' SESSION CANCELLED',
                    html: ejs.render(templates.studentCancellation, studentEmailData)
                }
                emailer.transporter.sendMail(studentCancellationEmail, error => {
                    if (error) {
                        console.error('Error when sending student cancellation email.', error);
                    }
                });
            }
            //This removes the first element of the peerLeaders list
            await sessionCollection.updateOne({ _id: objectId }, dbUpdates);
        } else {
            console.error('Invalid type when rejecting session. Expected "mentor" or "peerLeader", but got ' + type);
            return 'Something went wrong. An invalid type was passed in.';
        }

        return -1; //-1 means no error
    } catch (err) {
        console.error('Error cancelling session.', err);
        return 'Error cancelling session.';
    }
}

//Gets an object with the data about all of that users sessions
async function getSessions(type, googleId) {
    try {
        const sessionCollection = globalDB.collection('sessions');
        let sessions = {
            upcoming: [],
            past: [],
            cancelled: []
        }
        let cursor;
        if (type === 'student')
            cursor = await sessionCollection.find({ 'student.id': googleId });
        else if (type === 'mentor')
            cursor = await sessionCollection.find({ 'mentors.id': {$eq: googleId} });
        else if (type === 'peerLeader')
            cursor = await sessionCollection.find({ 'peerLeaders.id': {$eq: googleId} });
        else
            console.error('Error when getting sessions. type should be "student", "mentor", or "peerLeader"');

        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when getting sessions.', err);
            } else {
                const data = {
                    id: doc._id,
                    student: doc.student,
                    mentor: doc.mentorConfirm ? doc.mentors[0] : {
                        id: '',
                        name: 'None Confirmed'
                    },
                    mentorConfirm: doc.mentorConfirm,
                    peerLeader: doc.peerLeaderConfirm ? doc.peerLeaders[0] : {
                        id: '',
                        name: 'None Confirmed',
                        zoomLink: 'None Confirmed',
                        zoomPass: 'None Confirmed',
                        email:"None Confirmed"
                    },
                    peerLeaderConfirm: doc.peerLeaderConfirm,
                    dateTime: doc.dateTime,
                    subject: doc.subject,
                    length: doc.length,
                    ratings: doc.ratings
                }
                if (type == 'mentor' && !doc.mentorConfirm) {
                    if (!doc.cancelled && !doc.done) sessions.upcoming.push(data);
                } else if (type == 'peerLeader' && !doc.peerLeaderConfirm) {
                    if (!doc.cancelled && !doc.done) sessions.upcoming.push(data);
                } else {
                    if (doc.cancelled) sessions.cancelled.push(data);
                    else if (doc.done) sessions.past.push(data);
                    else sessions.upcoming.push(data);
                }
            }
        });
        //Sort sessions with newest first
        sessions.upcoming.sort((a, b) => b.dateTime - a.dateTime);
        sessions.past.sort((a, b) => b.dateTime - a.dateTime);
        sessions.cancelled.sort((a, b) => b.dateTime - a.dateTime);
        return sessions;
    } catch (err) {
        console.error('Error when getting sessions.', err);
    }
}

async function getAllUsers() {
    try {
        const userCollection = globalDB.collection('users');
        let users = {
            students: [],
            appliedMentors: [],
            mentors: [],
            appliedPeerLeaders: [],
            peerLeaders: []
        }
        const cursor = await userCollection.find({
            $or: [
                { isStudent: true },
                { appliedMentor: true },
                { appliedPeerLeader: true }
            ]
        });
        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when iterating over all users.', err);
            } else {
                if (doc.isStudent) users.students.push(doc);

                if (doc.isMentor) users.mentors.push(doc);
                else if (doc.appliedMentor) users.appliedMentors.push(doc);

                if (doc.isPeerLeader) users.peerLeaders.push(doc);
                else if (doc.appliedPeerLeader) users.appliedPeerLeaders.push(doc);
            }
        });
        return users;
    } catch (err) {
        console.error('Error getting all mentors.', err);
    }
}

//Gets a numerical score based on how likely a mentor should tutor a session
const score = (rating, lastSession) => {
    const daysPassed = (Date.now() - lastSession) / (1000*60*60*24);
    //The longer the days passed, and the higher the rating, the more likely
    return rating + (daysPassed * 2.5);
}

//Get a list of mentors that are able to mentor a certain session
async function getMentors(dateTime, subject, studentId) {
    try {
        const userCollection = globalDB.collection('users');
        const date = new Date(dateTime);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let time = 'Afternoon'; //Afternoon is from 12pm-4pm
        if (date.getHours() < 12) time = 'Morning'; //Morning is until 11:59am
        else if (date.getHours() >= 12 + 4) time = 'Evening'; //Evening is after 3:59pm
        const dateTimeStr = days[date.getDay()] + ' ' + time;
        let mentors = [];
        const cursor = await userCollection.find({ isMentor: true, subjects: subject, availability: dateTimeStr });
        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when iterating over mentors.', err);
            } else if (doc.googleId !== studentId) { //Make sure a mentor does not mentor themself
                mentors.push({
                    id: doc.googleId,
                    name: `${doc.firstName} ${doc.lastName}`,
                    rating: doc.rating,
                    lastSession: doc.lastSession,
                    email:doc.email
                });
            }
        });
        mentors.sort((a, b) => score(b.rating, b.lastSession) - score(a.rating, a.lastSession));
        mentors = mentors.slice(0, 3).map(mentor => {
            return {
                id: mentor.id,
                name: mentor.name,
                email: mentor.email
            }
        });

        mentors = mentors.slice(0, 3);
        return mentors;
    } catch (err) {
        console.error('Error getting mentors.', err);
    }
}

//Get a list of peer leaders that are able to oversee a certain session
async function getPeerLeaders(dateTime) {
    try {
        const userCollection = globalDB.collection('users');
        const date = new Date(dateTime);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let time = 'Afternoon'; //Afternoon is from 12pm-4pm
        if (date.getHours() < 12) time = 'Morning'; //Morning is until 11:59am
        else if (date.getHours() >= 12 + 4) time = 'Evening'; //Evening is after 3:59pm
        const dateTimeStr = days[date.getDay()] + ' ' + time;
        let peerLeaders = [];
        const cursor = await userCollection.find({ isPeerLeader: true, availability: dateTimeStr });
        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when iterating over peer leaders.', err);
            } else {
                peerLeaders.push({
                    id: doc.googleId,
                    name: `${doc.firstName} ${doc.lastName}`,
                    zoomLink: doc.zoomLink,
                    zoomPass: doc.zoomPass,
                    email:doc.email
                });
            }
        });
        return peerLeaders;
    } catch (err) {
        console.error('Error getting peer leaders.', err);
    }
}

//For a mentor, looks at all of the tutored session, and averages all of the ratings recieved, and stores that in the db
async function updateMentorRating(googleId) {
    try {
        const userCollection = globalDB.collection('users');
        const sessionCollection = globalDB.collection('sessions');
        const cursor = sessionCollection.find({ 'mentors.0.id': googleId, 'mentorConfirm': true, 'done': true });
        let rating = 0;
        let amt = 0;
        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when updating mentor rating.', err);
            } else {
                if (doc.ratings.hasOwnProperty('studentToMentor')) {
                    rating += doc.ratings.studentToMentor;
                    amt++;
                }
                if (doc.ratings.hasOwnProperty('peerLeaderToMentor')) {
                    rating += doc.ratings.peerLeaderToMentor;
                    amt++;
                }
            }
        });
        rating /= amt;
        userCollection.updateOne({ googleId }, { $set: { 'rating': rating } });
    } catch (err) {
        console.error('Something went wrong when updating a mentor rating.');
    }
}

//Adds fields to the ratings object of a session, depending on who is rating what
async function rateSession(googleId, type, sessionId, ratings) {
    try {
        const sessionCollection = globalDB.collection('sessions');
        let objectId;
        try {
            objectId = new ObjectId(sessionId);
        } catch (err) {
            return 'Session not found.'; //An invalid ObjectId was passed in
        }

        const session = await sessionCollection.findOne({ _id: objectId });
        if (session == null) return 'Session not found.';
        if (session.cancelled) return 'Session has been cancelled.';
        if (!session.done) return 'Session has not be complete. Please wait for the peerleader to mark the session as completed.';
        if (type == 'student') {
            if (session.student.id != googleId) //Make sure it is the student who requested the session
                return 'You are not authorized to rate this session as a student.';
            if (session.ratings.hasOwnProperty('studentToSession') ||
                session.ratings.hasOwnProperty('studentToMentor'))
                return 'This session has already been rated by the student.';
            await sessionCollection.updateOne({ _id: objectId }, {
                $set: {
                    'ratings.studentToMentor': ratings.studentToMentor,
                    'ratings.studentToSession': ratings.studentToSession
                }});
            //Each time a mentor is rated, update their rating
            if (session.mentors.length > 0 && session.mentorConfirm)
                updateMentorRating(session.mentors[0].id);
        } else if (type == 'mentor') {
            if (!session.mentorConfirm || session.mentors[0].id != googleId) //Make sure it is the mentor who tutored the session
                return 'You are not authorized to rate this session as a mentor.';
            if (session.ratings.hasOwnProperty('mentorToSession'))
                return 'This session has already been rated by the mentor.';
            await sessionCollection.updateOne({ _id: objectId }, {
                $set: {
                    'ratings.mentorToSession': ratings.mentorToSession
                }});
        } else if (type == 'peerLeader' ) {
            if (!session.peerLeaderConfirm || session.peerLeaders[0].id != googleId) //Make sure it is the peerleader who oversaw the session
                return 'You are not authorized to rate this session as a peerLeader.';
            if (session.ratings.hasOwnProperty('peerLeaderToMentor'))
                return 'This session has already been rated by the peerLeader.';
            await sessionCollection.updateOne({ _id: objectId }, {
                $set: {
                    'ratings.peerLeaderToMentor': ratings.peerLeaderToMentor
                }});
            //Each time a mentor is rated, update their rating
            if (session.mentors.length > 0 && session.mentorConfirm)
                updateMentorRating(session.mentors[0].id);
        } else {
            console.error('Invalid type when accepting session. Expected "student", "mentor" or "peerLeader", but got ' + type);
            return 'Something went wrong. An invalid type was passed in.';
        }

        return -1; //-1 means no error
    } catch (err) {
        console.error('Error rating session.', googleId, type, sessionId, ratings, err);
        return 'Something went wrong.';
    }
}

module.exports = {
    addUser, findUser, updateUser,
    addSession, cancelSession,
    doneSession, acceptSession, rejectSession,
    getSessions,
    getAllUsers, acceptUser, rejectUser,
    getMentors, getPeerLeaders,
    rateSession
};
