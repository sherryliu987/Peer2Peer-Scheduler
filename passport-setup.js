const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const models = require('./models'); //Used for the DB

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID, //Tokens required by Google
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/callback' //Once the user signs in, where to redirect them
},
    async (accessToken, refreshToken, profile, done) => {
        let userData; //An object to contain the user's info
        try {
            userData = await models.User.findOne({ googleId: profile.id }); //Fetch a user in the DB with that googleId
        } catch (err) {
            console.error('Error when finding user in db');
            console.error(err);
            return done(err);
        }
        if (!userData) { //If that user does not exist in the db, create a new entry
            userData = {
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails ? profile.emails[0].value : '', //In case of no email
                profileURL: profile.photos ? profile.photos[0].value : '', //In case of no photo
                //TODO Add a default photo (and maybe an email)
                clicks: 0,
            };
            const newUser = new models.User(userData); //Create and save the new user in the DB
            try {
                await newUser.save();
            } catch (err) {
                console.error('There was a problem adding the new user. Their data:');
                console.error(userData);
                console.error('The error:');
                console.error(err);
                return done(err);
            };
        }
        return done(null, userData); //The user's data will now be accessible in req.user
    }
));

passport.serializeUser((user, done) => { //This function serializes the user's data to be stored in a cookie. We only store the user's googleId to minimize cookies size
    done(null, user.googleId);
});
passport.deserializeUser(async (id, done) => { //This function finds the user's info based on their googleId
    try {
        const userData = await models.User.findOne({ googleId: id }); //Find the matching user in the DB
        done(null, userData); //This object will now be accessible in req.user
    } catch (err) {
        console.error('Error when deserializing user. User\'s google Id: ');
        console.error(googleId);
        console.error('Error: ');
        console.error(err);
        return done(err);
    }
});
