const MongoClient = require('mongodb').MongoClient;

async function findUser(googleId) {
    const client = new MongoClient(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const userCollection = client.db('test').collection('users');
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
        console.error('Error connecting to db.', err);
    }
}

module.exports = { addUser, findUser };
