const ObjectId = require('mongodb').ObjectId;

async function findUser(googleId) {
    try {
        const userCollection = globalDB.collection('users');
        const user = await userCollection.findOne({ googleId });
        return user;
    } catch (err) {
        console.error('Error when finding user.', err);
    }
}

async function addUser(userData) {
    try {
        const userCollection = globalDB.collection('users');
        await userCollection.insertOne(userData);
    } catch (err) {
        console.error('Error adding user.', err);
    }
}

async function updateUser(googleId, data) {
    try {
        const userCollection = globalDB.collection('users');
        await userCollection.updateOne({ googleId }, { $set: data });
    } catch (err) {
        console.error('Error updating user.', err);
    }
}

async function addSession(sessionData) {
    try {
        const sessionCollection = globalDB.collection('sessions');
        await sessionCollection.insertOne(sessionData);
    } catch (err) {
        console.error('Error adding session.', err);
    }
}

//TODO Refactor cancelSession errors
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

async function acceptSession(sessionId, mentorId) {
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
        if (session.mentorConfirm) return 'Session already confirmed.'
        if (session.mentors[0].id != mentorId) //Make sure it is asking this mentor to accept
            return 'You are not authorized to accept this session.';
        
        await sessionCollection.updateOne({ _id: objectId }, { $set: { mentorConfirm: true }});
        return -1; //-1 means no error
    } catch (err) {
        console.error('Error cancelling session.', err);
        return 'Error cancelling session.';
    }
}

async function rejectSession(sessionId, mentorId) {
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
        if (session.mentorConfirm) return 'Session already confirmed.'
        if (session.mentors[0].id != mentorId) //Make sure it is asking this mentor to reject
            return 'You are not authorized to reject this session.';

        //This removes the first element of the mentors list
        await sessionCollection.updateOne({ _id: objectId }, { $pop: { mentors: -1 } });
        return -1; //-1 means no error
    } catch (err) {
        console.error('Error cancelling session.', err);
        return 'Error cancelling session.';
    }
}

async function getUserSessions(studentId) {
    try {
        const sessionCollection = globalDB.collection('sessions');
        let sessions = {
            upcoming: [],
            past: [],
            cancelled: []
        }
        const cursor = await sessionCollection.find({ 'student.id': studentId });
        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when getting user sessions.', err);
            } else {
                const data = {
                    id: doc._id,
                    mentor: doc.mentorConfirm ? doc.mentors[0].name : 'None Confirmed',
                    peerLeader: doc.peerLeaderConfirm ? doc.peerLeaders[0].name : 'None Confirmed',
                    dateTime: doc.dateTime,
                    subject: doc.subject
                }
                if (doc.cancelled) sessions.cancelled.push(data);
                else if (doc.done) sessions.past.push(data);
                else sessions.upcoming.push(data);
            }
        });
        //Sort sessions with newest first
        sessions.upcoming.sort((a, b) => b.dateTime - a.dateTime);
        sessions.past.sort((a, b) => b.dateTime - a.dateTime);
        sessions.cancelled.sort((a, b) => b.dateTime - a.dateTime);
        return sessions;
    } catch (err) {
        console.error('Error adding session.', err);
    }
}

async function getMentorSessions(mentorId) {
    try {
        const sessionCollection = globalDB.collection('sessions');
        let sessions = {
            upcoming: [],
            past: [],
            cancelled: []
        }
        const cursor = await sessionCollection.find({ 'mentors.0.id': { $eq: mentorId} });
        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when getting mentor sessions.', err);
            } else {
                const data = {
                    id: doc._id,
                    confirm: doc.mentorConfirm,
                    student: doc.student,
                    peerLeader: doc.peerLeaderConfirm ? doc.peerLeaders[0].name : 'None Confirmed',
                    dateTime: doc.dateTime,
                    subject: doc.subject
                }
                if (doc.cancelled && doc.mentorConfirm) sessions.cancelled.push(data);
                else if (doc.done && doc.mentorConfirm) sessions.past.push(data);
                else if (!doc.cancelled) sessions.upcoming.push(data);
            }
        });
        //Sort sessions with newest first
        sessions.upcoming.sort((a, b) => b.dateTime - a.dateTime);
        sessions.past.sort((a, b) => b.dateTime - a.dateTime);
        sessions.cancelled.sort((a, b) => b.dateTime - a.dateTime);
        return sessions;
    } catch (err) {
        console.error('Error adding session.', err);
    }
}

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

module.exports = { addUser, findUser, updateUser, addSession, cancelSession, acceptSession, rejectSession, getUserSessions, getMentorSessions, getMentors, getPeerLeaders };
