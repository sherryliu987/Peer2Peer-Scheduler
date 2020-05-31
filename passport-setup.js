const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const models = require('./models'); 

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/callback'
},
    async (accessToken, refreshToken, profile, done) => {
        //Search for the user in the db by their googleId
        let userData;
        try {
            userData = await models.User.findOne({ googleId: profile.id });
        } catch (err) {
            console.error('Error when finding user in db');
            console.error(err);
            return done(err);
        }
        if (!userData) { //If a user does not exist in the db
            userData = {
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails ? profile.emails[0].value : '', //In case of no email
                profileURL: profile.photos ? profile.photos[0].value : '', //In case of no photo
                //TODO Add a default photo (and maybe an email)
                clicks: 0,
            };
            const newUser = new models.User(userData);
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
        return done(null, userData);
    }
));

passport.serializeUser((user, done) => {
    done(null, user.googleId);
});
passport.deserializeUser(async (id, done) => {
    try {
        const userData = await models.User.findOne({ googleId: id });
        done(null, userData);
    } catch (err) {
        console.error('Error when deserializing user. User\'s google Id: ');
        console.error(googleId);
        console.error('Error: ');
        console.error(err);
        return done(err);
    }
});
