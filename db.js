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
                    length: doc.length
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
                    subjects: doc.subjects
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

//TODO Ensure that mentors/peerleaders do not overlap sessions
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
        return mentors.slice(0, 3); //TODO Add a system to pick mentors based on how much they've worked and rating
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

module.exports = {
    addUser, findUser, updateUser,
    addSession, cancelSession,
    acceptSession, rejectSession,
    getSessions,
    getAllMentors,
    getMentors, getPeerLeaders
};
