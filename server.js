const connection = require("./db");
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");

const app = express();

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/accords", express.static(path.join(__dirname, "resource/accords")));

const FREE_LIMIT = 3;
const PREMIUM_LIMIT = 10;
const BLOCK_TIME = 24 * 60 * 60 * 1000;

app.get("/api/accords", (req, res) => {
  const query = "SELECT * FROM accords";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching accords:", err);
      res.status(500).send("Server error");
    } else {
      res.json(results);
    }
  });
});

app.post("/api/registration", async (req, res) => {
  const { login, email, password } = req.body;
  const hashPassword = await bcrypt.hash(password, 10);

  console.log("Request body:", req.body);

  connection.query(
    `SELECT user_id FROM users WHERE user_email = ?`,
    [email],
    (err, results) => {
      if (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Server error");
        return;
      }

      if (results.length !== 0) {
        res.status(401).send("User already exists");
        return;
      }

      connection.query(
        `INSERT INTO users (user_name, user_email, user_password,  user_subscription, user_neural_count)
        VALUES (?, ?, ?, 'free', 0)`,
        [login, email, hashPassword],
        (err) => {
          if (err) {
            console.error("Error inserting user:", err);
            res.status(500).send("Server error");
            return;
          }
          res.status(200).send("Registration is done");
        }
      );
    }
  );
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  connection.query(
    `SELECT user_id, user_name, user_subscription, user_password, user_start_sub, user_end_sub, user_neural_count, user_last_neural_date FROM users WHERE user_email = ?`,
    [email],
    async (err, results) => {
      if (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Server error");
        return;
      }

      if (results.length === 0) {
        res.status(401).send("Invalid email or password");
        return;
      }

      const isValid = await bcrypt.compare(password, results[0].user_password);

      if (!isValid) {
        res.status(401).send("Invalid email or password");
        return;
      }

      res.json({
        user_id: results[0].user_id,
        user_name: results[0].user_name,
        user_subscription: results[0].user_subscription,
        user_start_sub: results[0].user_start_sub,
        user_end_sub: results[0].user_end_sub,
        user_neural_count: results[0].user_neural_count,
        user_last_neural_date: results[0].user_last_neural_date,
      });
    }
  );
});

app.post("/api/add-history", (req, res) => {
  const { songId, userId } = req.body;
  const searchQuery = `SELECT * FROM search_history WHERE user_id = ? and song_id = ?`;
  connection.query(searchQuery, [userId, songId], (err, results) => {
    if (err) {
      console.error("Error fetching history:", err);
      res.status(500).send("Server error");
      return;
    }

    if (results.length !== 0) {
      connection.query(
        `DELETE FROM search_history WHERE user_id = ? and song_id = ?`,
        [userId, songId],
        (err, results) => {
          if (err) {
            console.error("Error delete:", err);
            res.status(500).send("Server error");
            return;
          }
        }
      );
    }

    const insertQuery = `INSERT INTO search_history (user_id, song_id) VALUES (?, ?)`;
    connection.query(insertQuery, [userId, songId], (err, results) => {
      if (err) {
        console.log("Error insert: ", err);
        res.status(500).send();
        return;
      }

      res.status(200).send();
    });
  });
});

app.get("/api/artists", (req, res) => {
  const query = "SELECT * FROM artists";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching accords:", err);
      res.status(500).send("Server error");
    } else {
      res.json(results);
    }
  });
});

app.get("/api/favorites", (req, res) => {
  const { id } = req.query;

  const query = `
    SELECT s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment,
           a.artist_name, u.user_name, 
           GROUP_CONCAT(DISTINCT ac.accord_name) AS accords,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'like' AND song_id = s.song_id), 0) AS like_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'dislike' AND song_id = s.song_id), 0) AS dislike_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE song_id = s.song_id), 0) AS song_views
    FROM songs s
    JOIN artists a ON s.artist_id = a.artist_id
    JOIN users u ON u.user_id = s.user_id
    LEFT JOIN song_accords sa ON s.song_id = sa.song_id
    LEFT JOIN accords ac ON sa.accord_id = ac.accord_id
    LEFT JOIN favorites f ON f.song_id = s.song_id
    WHERE f.user_id = ?
    GROUP BY s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment, a.artist_name, u.user_name
  `;

  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error fetching favorites:", err);
      res.status(500).send("Server error");
    } else {
      res.json(results);
    }
  });
});

app.get("/api/songs", (req, res) => {
  const query = `
    SELECT s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment,
           a.artist_name, u.user_name,
           GROUP_CONCAT(DISTINCT ac.accord_name) AS accords,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'like' AND song_id = s.song_id), 0) AS like_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'dislike' AND song_id = s.song_id), 0) AS dislike_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE song_id = s.song_id), 0) AS song_views
    FROM songs s
    JOIN artists a ON s.artist_id = a.artist_id
    JOIN users u ON u.user_id = s.user_id
    LEFT JOIN song_accords sa ON s.song_id = sa.song_id
    LEFT JOIN accords ac ON sa.accord_id = ac.accord_id
    LEFT JOIN song_user_actions sua ON s.song_id = sua.song_id
    GROUP BY s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment, a.artist_name, u.user_name
    ORDER BY song_views DESC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching songs:", err);
      res.status(500).send("Server error");
    } else {
      res.json(results);
    }
  });
});

app.post("/api/use-ai", (req, res) => {
  const { id } = req.body;

  connection.query(
    "SELECT user_neural_count, user_subscription, user_last_neural_date FROM users WHERE user_id = ?",
    [id],
    (err, results) => {
      if (err) {
        console.error("Error checking existing record:", err);
        res.status(500).send("Server error");
        return;
      }

      if (results.length === 0) {
        res.status(404).send("User not found");
        return;
      }

      const user = results[0];
      const now = new Date();
      const lastUse = new Date(user.user_last_neural_date);
      const diffTime = now - lastUse; // Разница во времени в миллисекундах

      let limit;
      if (user.user_subscription === "free") {
        limit = FREE_LIMIT;
      } else if (user.user_subscription === "premium") {
        limit = PREMIUM_LIMIT;
      }

      if (user.user_neural_count >= limit && diffTime < BLOCK_TIME) {
        const remainingTime = BLOCK_TIME - diffTime;
        res
          .status(403)
          .json({ blocked: true, remaining_time: remainingTime / 1000 });
      } else {
        if (user.user_neural_count >= limit && diffTime >= BLOCK_TIME) {
          connection.query(
            "UPDATE users SET user_neural_count = 1, user_last_neural_date = CURRENT_TIMESTAMP WHERE user_id = ?",
            [id],
            (err, results) => {
              if (err) {
                console.error("Error updating record:", err);
                res.status(500).send("Server error");
                return;
              }
              res.status(201).send("Usage updated and count reset");
            }
          );
        } else {
          connection.query(
            "UPDATE users SET user_neural_count = user_neural_count + 1, user_last_neural_date = CURRENT_TIMESTAMP WHERE user_id = ?",
            [id],
            (err, results) => {
              if (err) {
                console.error("Error updating record:", err);
                res.status(500).send("Server error");
                return;
              }
              res.status(201).send("Usage updated");
            }
          );
        }
      }
    }
  );
});

app.post("/api/stop-model", (req, res) => {
  const { id } = req.query;

  connection.query(
    "UPDATE users SET user_last_neural_date = CURRENT_TIMESTAMP WHERE user_id = ?",
    [id],
    (err, results) => {
      if (err) {
        console.error("Error updating record:", err);
        res.status(500).send("Server error");
        return;
      }
      res.status(200).send("Model is blocked");
    }
  );
});

app.get("/api/top-songs", (req, res) => {
  const query = `
    SELECT s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment,
           a.artist_name, u.user_name,
           GROUP_CONCAT(DISTINCT ac.accord_name) AS accords,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'like' AND song_id = s.song_id), 0) AS like_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'dislike' AND song_id = s.song_id), 0) AS dislike_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE song_id = s.song_id), 0) AS song_views
    FROM songs s
    JOIN artists a ON s.artist_id = a.artist_id
    JOIN users u ON u.user_id = s.user_id
    LEFT JOIN song_accords sa ON s.song_id = sa.song_id
    LEFT JOIN accords ac ON sa.accord_id = ac.accord_id
    LEFT JOIN song_user_actions sua ON s.song_id = sua.song_id
    GROUP BY s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment, a.artist_name, u.user_name
    ORDER BY song_views DESC
    LIMIT 50
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching songs:", err);
      res.status(500).send("Server error");
    } else {
      res.json(results);
    }
  });
});

app.get("/api/history-songs", (req, res) => {
  const { userId } = req.query;

  const query = `
    SELECT s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment,
           a.artist_name, u.user_name, 
           GROUP_CONCAT(DISTINCT ac.accord_name) AS accords,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'like' AND song_id = s.song_id), 0) AS like_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'dislike' AND song_id = s.song_id), 0) AS dislike_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE song_id = s.song_id), 0) AS song_views
    FROM songs s
    JOIN artists a ON s.artist_id = a.artist_id
    JOIN users u ON u.user_id = s.user_id
    LEFT JOIN song_accords sa ON s.song_id = sa.song_id
    LEFT JOIN accords ac ON sa.accord_id = ac.accord_id
    LEFT JOIN search_history sh ON s.song_id = sh.song_id
    WHERE sh.user_id = ?
    GROUP BY s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment, a.artist_name, u.user_name
    LIMIT 5
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error fetching songs:", err);
      res.status(500).send("Server error");
    } else {
      res.json(results);
    }
  });
});

app.post("/api/add-favorites", (req, res) => {
  const { userId, songId } = req.body;

  // Проверка на существование записи в избранном
  const checkQuery =
    "SELECT * FROM favorites WHERE user_id = ? AND song_id = ?";
  connection.query(checkQuery, [userId, songId], (checkErr, checkResults) => {
    if (checkErr) {
      console.error("Error checking favorite:", checkErr);
      res.status(500).send("Server error");
      return;
    }

    if (checkResults.length > 0) {
      // Если запись существует, удаляем её
      const deleteQuery =
        "DELETE FROM favorites WHERE user_id = ? AND song_id = ?";
      connection.query(
        deleteQuery,
        [userId, songId],
        (deleteErr, deleteResults) => {
          if (deleteErr) {
            console.error("Error deleting favorite:", deleteErr);
            res.status(500).send("Server error");
          } else {
            res.status(200).send("Song removed from favorites");
          }
        }
      );
    } else {
      // Если записи нет, добавляем её
      const insertQuery =
        "INSERT INTO favorites (user_id, song_id) VALUES (?, ?)";
      connection.query(
        insertQuery,
        [userId, songId],
        (insertErr, insertResults) => {
          if (insertErr) {
            console.error("Error adding favorite:", insertErr);
            res.status(500).send("Server error");
          } else {
            res.status(201).send("Song added to favorites");
          }
        }
      );
    }
  });
});

app.get("/api/liked-songs", (req, res) => {
  const { userId } = req.query;

  const query = `
    SELECT s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment,
           a.artist_name, u.user_name, 
           GROUP_CONCAT(DISTINCT ac.accord_name) AS accords,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'like' AND song_id = s.song_id), 0) AS like_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'dislike' AND song_id = s.song_id), 0) AS dislike_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE song_id = s.song_id), 0) AS song_views
    FROM songs s
    JOIN artists a ON s.artist_id = a.artist_id
    JOIN users u ON u.user_id = s.user_id
    LEFT JOIN song_accords sa ON s.song_id = sa.song_id
    LEFT JOIN accords ac ON sa.accord_id = ac.accord_id
    LEFT JOIN search_history sh ON s.song_id = sh.song_id
    LEFT JOIN song_user_actions sua ON s.song_id = sua.song_id
    WHERE sua.user_id = ? AND sua.action_type = 'like'
    GROUP BY s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment, a.artist_name, u.user_name
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.log("Error get request");
      res.status(500).send();
      return;
    }

    res.json(results);
  });
});

app.get("/api/user-songs", (req, res) => {
  const { userId } = req.query;

  const query = `
    SELECT s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment,
           a.artist_name, u.user_name, 
           GROUP_CONCAT(DISTINCT ac.accord_name) AS accords,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'like' AND song_id = s.song_id), 0) AS like_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE action_type = 'dislike' AND song_id = s.song_id), 0) AS dislike_count,
           IFNULL((SELECT COUNT(*) FROM song_user_actions WHERE song_id = s.song_id), 0) AS song_views
    FROM songs s
    JOIN artists a ON s.artist_id = a.artist_id
    JOIN users u ON u.user_id = s.user_id
    LEFT JOIN song_accords sa ON s.song_id = sa.song_id
    LEFT JOIN accords ac ON sa.accord_id = ac.accord_id
    LEFT JOIN search_history sh ON s.song_id = sh.song_id
    WHERE s.user_id = ?
    GROUP BY s.song_id, s.song_title, s.artist_id, s.song_text, s.user_id, s.song_date, s.song_comment, a.artist_name, u.user_name
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.log("Error get request");
      res.status(500).send();
      return;
    }

    res.json(results);
  });
});

app.get("/api/song-status", (req, res) => {
  const { userId, songId } = req.query;

  const likeQuery =
    "SELECT COUNT(*) as count FROM song_user_actions WHERE user_id = ? AND song_id = ? AND action_type = 'like'";
  const dislikeQuery =
    "SELECT COUNT(*) as count FROM song_user_actions WHERE user_id = ? AND song_id = ? AND action_type = 'dislike'";
  const favoriteQuery =
    "SELECT COUNT(*) as count FROM favorites WHERE user_id = ? AND song_id = ?";

  connection.query(likeQuery, [userId, songId], (likeErr, likeResults) => {
    if (likeErr) {
      console.error("Error checking like:", likeErr);
      res.status(500).send("Server error");
      return;
    }

    connection.query(
      dislikeQuery,
      [userId, songId],
      (dislikeErr, dislikeResults) => {
        if (dislikeErr) {
          console.error("Error checking dislike:", dislikeErr);
          res.status(500).send("Server error");
          return;
        }

        connection.query(
          favoriteQuery,
          [userId, songId],
          (favoriteErr, favoriteResults) => {
            if (favoriteErr) {
              console.error("Error checking favorite:", favoriteErr);
              res.status(500).send("Server error");
              return;
            }

            res.json({
              isLiked: likeResults[0].count > 0,
              isDisliked: dislikeResults[0].count > 0,
              isFavorite: favoriteResults[0].count > 0,
            });
          }
        );
      }
    );
  });
});

app.post("/api/song-like", (req, res) => {
  const { userId, songId, actionType } = req.body;
  const selectQuery =
    "SELECT COUNT(*) AS count FROM song_user_actions WHERE user_id = ? AND song_id = ?";
  const updateQuery =
    "UPDATE song_user_actions SET action_type = ? WHERE user_id = ? AND song_id = ?";
  const insertQuery =
    "INSERT INTO song_user_actions (user_id, song_id, action_type) VALUES (?, ?, ?)";

  connection.query(selectQuery, [userId, songId], (err, results) => {
    if (err) {
      console.error("Error checking existing record:", err);
      res.status(500).send("Server error");
      return;
    }

    if (results[0].count > 0) {
      // If record exists, update action_type
      connection.query(
        updateQuery,
        [actionType, userId, songId],
        (updateErr, updateResults) => {
          if (updateErr) {
            console.error("Error updating record:", updateErr);
            res.status(500).send("Server error");
          } else {
            res.sendStatus(200);
          }
        }
      );
    } else {
      // If record does not exist, insert new record
      connection.query(
        insertQuery,
        [userId, songId, actionType],
        (insertErr, insertResults) => {
          if (insertErr) {
            console.error("Error inserting new record:", insertErr);
            res.status(500).send("Server error");
          } else {
            res.sendStatus(200);
          }
        }
      );
    }
  });
});

app.post("/api/record-visit", (req, res) => {
  const { userId, songId } = req.body;
  const selectQuery =
    "SELECT COUNT(*) AS count FROM song_user_actions WHERE user_id = ? AND song_id = ?";
  const updateQuery =
    "UPDATE song_user_actions SET view_date = CURRENT_TIMESTAMP WHERE user_id = ? AND song_id = ?";
  const insertQuery =
    "INSERT INTO song_user_actions (user_id, song_id, view_date) VALUES (?, ?, CURRENT_TIMESTAMP)";
  connection.query(selectQuery, [userId, songId], (err, results) => {
    if (err) {
      console.error("Error checking existing record:", err);
      res.status(500).send("Server error");
      return;
    }

    if (results[0].count > 0) {
      connection.query(
        updateQuery,
        [userId, songId],
        (updateErr, updateResults) => {
          if (updateErr) {
            console.error("Error updating record:", updateErr);
            res.status(500).send("Server error");
          } else {
            res.sendStatus(200);
          }
        }
      );
    } else {
      connection.query(
        insertQuery,
        [userId, songId],
        (insertErr, insertResults) => {
          if (insertErr) {
            console.error("Error inserting new record:", insertErr);
            res.status(500).send("Server error");
          } else {
            res.sendStatus(200);
          }
        }
      );
    }
  });
});

app.post("/api/create-song", (req, res) => {
  const { title, artist, songText, selectedAccords, comment, userId } =
    req.body;

  // Проверка, существует ли артист в базе данных
  connection.query(
    "SELECT artist_id FROM artists WHERE LOWER(artist_name) = LOWER(?)",
    [artist],
    (err, artistResult) => {
      if (err) {
        console.error("Ошибка при проверке артиста:", err);
        res.status(500).send("Ошибка сервера");
        return;
      }

      let artistId;
      if (artistResult.length > 0) {
        artistId = artistResult[0].artist_id;
        insertSong(artistId);
      } else {
        // Если артист не существует, создаем нового артиста
        connection.query(
          "INSERT INTO artists (artist_name) VALUES (?)",
          [artist],
          (err, newArtistResult) => {
            if (err) {
              console.error("Ошибка при создании нового артиста:", err);
              res.status(500).send("Ошибка сервера");
              return;
            }
            artistId = newArtistResult.insertId;
            insertSong(artistId);
          }
        );
      }
    }
  );

  function insertSong(artistId) {
    connection.query(
      "INSERT INTO songs (song_title, artist_id, song_text, user_id, song_comment, song_date) VALUES (?, ?, ?, ?, ?, NOW())",
      [title, artistId, songText, userId, comment],
      (err, result) => {
        if (err) {
          console.error("Ошибка при вставке новой песни:", err);
          res.status(500).send("Ошибка сервера");
          return;
        }

        const songId = result.insertId;

        // Вставка аккордов для песни в таблицу song_accords
        selectedAccords.forEach((accord) => {
          connection.query(
            "INSERT INTO song_accords (song_id, accord_id) VALUES (?, ?)",
            [songId, accord.accord_id],
            (err) => {
              if (err) {
                console.error("Ошибка при вставке аккордов:", err);
                res.status(500).send("Ошибка сервера");
                return;
              }
            }
          );
        });

        res.status(201).json({ message: "Песня успешно создана" });
      }
    );
  }
});

app.listen(PORT, (error) => {
  if (error) {
    console.log("Ошибка подключения к серверу:", error);
    return;
  }

  console.log("Серевер запущен на порту", PORT);
});
