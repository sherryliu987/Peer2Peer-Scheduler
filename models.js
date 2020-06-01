const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
mongoose.connection.on('connected', () => console.log("Mongoose is connected"));

const UserSchema = new mongoose.Schema({
    googleId: String,
    displayName: String,
    profileURL: String,
    email: String,
});
const User = mongoose.model('User', UserSchema);

module.exports = {User};
