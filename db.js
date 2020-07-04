const MongoClient = require('mongodb').MongoClient;

async function findUser(googleId) {
    const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const userCollection = client.db(process.env.MONGODB_NAME).collection('users');
        const user = await userCollection.findOne({ googleId });
        client.close();
        return user;
    } catch (err) {
        console.error('Error when finding user.', err);
    }
}

async function addUser(userData) {
    const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const userCollection = client.db(process.env.MONGODB_NAME).collection('users');
        await userCollection.insertOne(userData);
        client.close();
    } catch (err) {
        console.error('Error adding user.', err);
    }
}

async function updateUser(googleId, data) {
    const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const userCollection = client.db(process.env.MONGODB_NAME).collection('users');
        await userCollection.updateOne({ googleId }, { $set: data });
    } catch (err) {
        console.error('Error updating user.', err);
    }
}

async function addSession(sessionData) {
    const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const sessionCollection = client.db(process.env.MONGODB_NAME).collection('sessions');
        await sessionCollection.insertOne(sessionData);
        client.close();
    } catch (err) {
        console.error('Error adding session.', err);
    }
}

async function getUserSessions(studentId) {
    const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const sessionCollection = client.db(process.env.MONGODB_NAME).collection('sessions');
        let sessions = {
            upcoming: [],
            past: [],
            cancelled: []
        }
        const cursor = await sessionCollection.find({ studentId: studentId });
        await cursor.forEach((doc, err) => {
            if (err) {
                console.error('Error when getting user sessions.', err);
            } else {
                const data = {
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
        client.close();
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
    const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const userCollection = client.db(process.env.MONGODB_NAME).collection('users');
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
        client.close();
        return mentors.slice(0, 3); //TODO Add a system to pick mentors based on how much they've worked and rating
    } catch (err) {
        console.error('Error getting mentors.', err);
    }
}

async function getPeerLeaders(dateTime) {
    const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const userCollection = client.db(process.env.MONGODB_NAME).collection('users');
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
        client.close();
        return peerLeaders;
    } catch (err) {
        console.error('Error getting peer leaders.', err);
    }
}

module.exports = { addUser, findUser, updateUser, addSession, getUserSessions, getMentors, getPeerLeaders };
