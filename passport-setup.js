const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db.js'); //Used for the DB

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID, //Tokens required by Google
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/callback' //Once the user signs in, where to redirect them
},
    async (accessToken, refreshToken, profile, done) => {
        let userData = await db.findUser(profile.id); //An object to contain the user's info
        if (!userData) { //If that user does not exist in the db, create a new entry
            userData = {
                googleId: profile.id,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                email: profile.emails ? profile.emails[0].value : '', //In case of no email
                profileURL: profile.photos ? profile.photos[0].value : '', //In case of no photo
                isStudent: false,
                isMentor: false, //If they are a mentor
                appliedMentor: false, //If they have applied to become a mentor
                isPeerLeader: false,
                appliedPeerLeader: false
            };
            await db.addUser(userData);
        }
        return done(null, userData); //The user's data will now be accessible in req.user
    }
));

passport.serializeUser((user, done) => { //This function serializes the user's data to be stored in a cookie. We only store the user's googleId to minimize cookies size
    done(null, user.googleId);
});
passport.deserializeUser(async (id, done) => { //This function finds the user's info based on their googleId
    id = "peerleader";
    const userData = await db.findUser(id); //Find the matching users' data
    done(null, userData);
});
