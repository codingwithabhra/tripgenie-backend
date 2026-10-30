import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {

    const authHeader = req.headers.authorization;

    //check header format
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Invalid token format (Bearer missing)"
        });
    };

    //console.log("Auth Header:", authHeader);

    //extract token
    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Token not found after Bearer"
        });
    };

    // console.log("Extracted Token:", token);
    // console.log("JWT SECRET:", process.env.JWT_SECRET);

    try {
        //verify token
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        //console.log("Decoded token: ", decodedToken);

        //attach user info to token
        req.user = decodedToken;

        next();

    } catch (error) {
        console.log("JWT ERROR:", error.message);

        return res.status(401).json({
            message: error.message   // shows exact issue
        });
    }
};

export default authMiddleware;