const ObjectId = require('mongodb').ObjectId;

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

        await sessionCollection.updateOne({ _id: objectId, "student.id": studentId }, { $set: { cancelled: true }});
        return -1; //-1 means no error
    } catch (err) {
        console.error('Error cancelling session.', err);
        return 'Error cancelling session.';
    }
}

//A peer leader uses this function to accept a mentor applicaiton.
async function acceptMentor(userObjectId) {
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
        if (!user.appliedMentor) return 'That user has not applied to be a mentor.';
        if (user.isMentor) return 'That user is already a mentor.';
        await userCollection.updateOne({ _id: objectId }, { $set: { isMentor: true }});
        return -1; //-1 means no error
    } catch (err) {
        console.error('Error accepting mentor.', err);
        return 'Error accepting mentor.';
    }
}

//A peer leader uses this function to reejct a mentor applicaiton.
async function rejectMentor(userObjectId) {
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
        if (!user.appliedMentor) return 'That user has not applied to be a mentor.';
        if (user.isMentor) return 'That user is already a mentor.';
        await userCollection.updateOne({ _id: objectId }, { $set: { appliedMentor: false }});
        return -1; //-1 means no error
    } catch (err) {
        console.error('Error rejecting mentor.', err);
        return 'Error rejecting mentor.';
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
            if (session.mentors[0].id != googleId) //Make sure it is asking this mentor to accept
                return 'You are not authorized to accept this session.';
            await sessionCollection.updateOne({ _id: objectId }, { $set: { mentorConfirm: true }});
        } else if (type == 'peerLeader') {
            if (session.peerLeaderConfirm) return 'Session already confirmed.'
            if (session.peerLeaders[0].id != googleId) //Make sure it is asking this mentor to accept
                return 'You are not authorized to accept this session.';
            await sessionCollection.updateOne({ _id: objectId }, { $set: { peerLeaderConfirm: true }});
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
        if (session.done) return 'Session has already been complete.';
        if (type == 'mentor') {
            if (session.mentorConfirm) return 'Session already confirmed.'
            if (session.mentors[0].id != googleId) //Make sure it is asking this mentor to reject
                return 'You are not authorized to reject this session.';
            //This removes the first element of the mentors list
            await sessionCollection.updateOne({ _id: objectId }, { $pop: { mentors: -1 } });
        } else if (type == 'peerLeader') {
            if (session.peerLeaderConfirm) return 'Session already confirmed.'
            if (session.peerLeaders[0].id != googleId) //Make sure it is asking this mentor to reject
                return 'You are not authorized to reject this session.';
            //This removes the first element of the peer leaders list
            await sessionCollection.updateOne({ _id: objectId }, { $pop: { peerLeaders: -1 } });
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
        if (type == 'student')
            cursor = await sessionCollection.find({ 'student.id': googleId });
        else if (type == 'mentor')
            cursor = await sessionCollection.find({ 'mentors.0.id': {$eq: googleId} });
        else if (type == 'peerLeader')
            cursor = await sessionCollection.find({ 'peerLeaders.0.id': {$eq: googleId} });
        else
            console.error('Error when getting sessions. type should be "student", "mentor", or "peerLeader"');

        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when getting sessions.', err);
            } else {
                const data = {
                    id: doc._id,
                    student: doc.student,
                    mentor: doc.mentorConfirm ? doc.mentors[0].name : 'None Confirmed',
                    mentorConfirm: doc.mentorConfirm,
                    peerLeader: doc.peerLeaderConfirm ? doc.peerLeaders[0].name : 'None Confirmed',
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

async function getAllMentors() {
    try {
        const userCollection = globalDB.collection('users');
        let mentors = {
            isMentor: [],
            applied: []
        };
        const cursor = await userCollection.find({
            appliedMentor: true
        });
        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when iterating over all mentors.', err);
            } else { //Make sure a mentor does not mentor themself
                const data = {
                    name: doc.firstName + ' ' + doc.lastName,
                    email: doc.email,
                    grade: doc.grade,
                    phone: doc.phone,
                    school: doc.school,
                    state: doc.state,
                    availability: doc.availability,
                    subjects: doc.subjects,
                    rating: doc.hasOwnProperty('rating') ? doc.rating : 'Not yet rated.',
                    id: doc._id //Note: This uses the ObjectId, NOT the googleId!
                }
                if (doc.isMentor) mentors.isMentor.push(data);
                else if (doc.appliedMentor) mentors.applied.push(data);
                else console.error('Error when iterating over all mentors. A user who has not applied to be mentor was found.');
            }
        });
        return mentors;
    } catch (err) {
        console.error('Error getting all mentors.', err);
    }
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
            } else if (doc.googleId != studentId) { //Make sure a mentor does not mentor themself
                mentors.push({ id: doc.googleId, name: `${doc.firstName} ${doc.lastName}` });
            }
        });
        return mentors.slice(0, 3);
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
                peerLeaders.push({ id: doc.googleId, name: `${doc.firstName} ${doc.lastName}`});
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
    getAllMentors, acceptMentor, rejectMentor,
    getMentors, getPeerLeaders,
    rateSession
};
