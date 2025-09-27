import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "redis";
import { RedisStore } from "connect-redis";
import { fileURLToPath } from "url";
import path from "path";
import session from "express-session";

dotenv.config();

const app = express();
const port = 3007;

const redisClient = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,

  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

redisClient.on("error", (err) => {
  console.log("Redis client Error: ", err);
});

await redisClient.connect();
console.log("Redis connected:", await redisClient.ping()); // should print "PONG"

const __filePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filePath);

const API_URL = "https://api.tvmaze.com";

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");

//setup Livereload in development mode

if (!isProduction) {
  const liveReload = await import("livereload");
  const connectLiveReload = (await import("connect-livereload")).default;
  const liveReloadServer = liveReload.createServer({
    exts: ["css", "js", "ejs"],
    liveCSS: true,
  });

  liveReloadServer.watch(path.join(__dirname, "views"));
  liveReloadServer.watch(path.join(__dirname, "public"));

  liveReloadServer.server.once("connection", () => {
    console.log("Livereload connected...");
    console.log("LiveReload is now watching 'views' and 'public' ");
  });

  app.use(connectLiveReload());

  //no caching for development
  app.use((req, res, next) => {
    res.set("cache-control", "no-store");
    next();
  });
}

//middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

let redisStore = new RedisStore({ client: redisClient });

app.use(
  session({
    store: redisStore,
    secret: process.env.SESSION_SECRET || "super-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction ? true : false,
      httpOnly: true,
      sameSite: isProduction ? "strict" : "lax",
    },
  })
);

function errorHandler(error) {
  let errorText;

  if (error.response) {
    if (error.response.status === "404") {
      errorText = `movie(s) not found!`;
    } else {
      console.log(error.response.data);
    }
  } else if (error.request) {
    errorText = `The Server is not responding. Please check your connection.`;
    console.log(error.request);
  } else {
    errorText = `Something went wrong`;
    console.log(error);
    console.log(error.message);
  }

  return errorText;
}

function stripTags(htmlText) {
  return htmlText.replace(/<\/?[^>]+(>|$)/g, "");
}

//Route Handlers
app.get("/", async (req, res) => {
  try {
    const response = await axios.get(`${API_URL}/shows?page=0`);
    let shows = response.data;
    shows.forEach((show) => {
      const truncatedSummary = stripTags(show.summary || "");
      show.truncatedSummary = truncatedSummary;
    });
    res.render("index.ejs", { shows });
  } catch (error) {
    console.log(error);
    const friendlyMessage = errorHandler(error);
    res.render("index.ejs", { friendlyMessage });
  }
});

app.get("/shows/:id", async (req, res) => {
  const showId = req.params.id;
  let show;
  let episodes;
  let cast;
  let showError;
  let episodesError;
  let castError;

  try {
    const response = await axios.get(`${API_URL}/shows/${showId}`);
    show = response.data;
  } catch (error) {
    showError = errorHandler(error);
  }

  try {
    const response = await axios.get(`${API_URL}/shows/${showId}/episodes`);
    episodes = response.data;
  } catch (error) {
    episodesError = errorHandler(error);
  }

  try {
    const response = await axios.get(`${API_URL}/shows/${showId}/cast`);
    cast = response.data;
  } catch (error) {
    castError = errorHandler(error);
  }

  res.render("show-page.ejs", {
    show,
    episodes,
    cast,
    showError,
    episodesError,
    castError,
  });
});

app.get("/search", async (req, res) => {
  const q = req.query.show;
  const config = { params: { q } };

  try {
    const response = await axios.get(`${API_URL}/search/shows`, config);
    let shows = response.data;
    shows.forEach((searchItem) => {
      const truncatedSummary = stripTags(searchItem.show.summary || "");
      searchItem.show.truncatedSummary = truncatedSummary;
    });
    res.render("search-page.ejs", { shows, q });
  } catch (error) {
    let showsError = errorHandler(error);
    res.render("search-page.ejs", { showsError, q });
  }
});

async function retrieveFavoriteShows(idArray) {
  const showArray = [];

  const requests = idArray.map((id) => {
    return axios.get(`${API_URL}/shows/${id}`);
  });

  let responses = await Promise.allSettled(requests);

  responses.forEach((response, index) => {
    const id = idArray[index];
    if (response.status === "fulfilled") {
      const truncatedSummary = stripTags(response.value.data.summary || "");
      response.value.data.truncatedSummary = truncatedSummary;
      showArray.push(response.value.data);
    } else {
      showArray.push({
        error: "The show could not be retrieved!",
        id,
      });
    }
  });

  return showArray;
}

app.post("/favorites-builder", (req, res) => {
  req.session.favorites = req.body;
  res.json({ success: true, favorites: req.session.favorites });
});

app.get("/favourites", async (req, res) => {
  console.log("Session at /favourites:", req.session); // check for persistence
  const ids = req.session.favorites?.currentFavorites || [];
  const shows = await retrieveFavoriteShows(ids);

  res.render("favourites.ejs", { shows });
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

app.get("/test-session", (req, res) => {
  req.session.hello = "world";
  res.send("Session set!");
});

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
