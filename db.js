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

async function getMentors(dateTime, subject) {
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
            } else {
                mentors.push(doc.googleId);
            }
        });
        client.close();
        return mentors.slice(0, 3); //TODO Add a system to pick mentors based on how much they've worked and rating
    } catch (err) {
        console.error('Error getting mentors.', err);
    }
}

module.exports = { addUser, findUser, updateUser, addSession, getMentors };
