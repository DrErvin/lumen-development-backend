const express = require("express");
const cors = require("cors");
const { readFile, writeFile } = require("fs");
const path = require("path");
const transporter = require("./email.js");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Specify the uploads folder
  },
  filename: (req, file, cb) => {
    // Preserve the original filename
    const uniqueSuffix = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}`;
    const originalName = file.originalname;
    cb(null, `${uniqueSuffix}-${originalName}`); // Append timestamp to avoid overwriting
  },
});
const upload = multer({ storage: storage }); // Temporary directory for uploaded files

const app = express();
const PORT = 3000; // Choose a port number

app.use(cors());
app.use(express.json()); // Use express.json() for parsing JSON bodies

// File paths to the JSON data
const OPPORTUNITIES_FILE = path.join(
  __dirname,
  "opportunityData.json"
);
const ACCOUNTS_FILE = path.join(__dirname, "accountData.json");
const APPLICATIONS_FILE = path.join(
  __dirname,
  "applicationsData.json"
);
const WU_FILE = path.join(
  __dirname,
  "world_universities_and_domains.json"
);

// Default route for '/'
app.get("/", (req, res) => {
  res.send(
    "Welcome to the API. Use /opportunities, /accounts, /applications or /world-universities to fetch data."
  );
});

// GET endpoint to fetch all opportunities
app.get("/opportunities", (req, res) => {
  readFile(OPPORTUNITIES_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).send("Error reading data");
    }
    res.json(JSON.parse(data));
  });
});

// POST endpoint to add a new opportunity
app.post("/opportunities", (req, res) => {
  readFile(OPPORTUNITIES_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).json({
        status: "error",
        message: "Error reading data file.",
      });
    }

    try {
      const opportunities = JSON.parse(data);
      const newOpportunity = req.body;
      opportunities.push(newOpportunity);

      writeFile(
        OPPORTUNITIES_FILE,
        JSON.stringify(opportunities, null, 2),
        (writeErr) => {
          if (writeErr) {
            console.error("Error writing file:", writeErr);
            return res.status(500).json({
              status: "error",
              message: "Error saving opportunity data.",
            });
          }

          res.status(201).json({
            status: "success",
            data: newOpportunity,
          });
        }
      );
    } catch (parseErr) {
      console.error("Error parsing JSON:", parseErr);
      res.status(500).json({
        status: "error",
        message: "Error parsing data file.",
      });
    }
  });
});

// GET endpoint to fetch all accounts
app.get("/accounts", (req, res) => {
  readFile(ACCOUNTS_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).send("Error reading data");
    }
    res.json(JSON.parse(data));
  });
});

// POST endpoint to add a new account
app.post("/accounts", (req, res) => {
  readFile(ACCOUNTS_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).json({
        status: "error",
        message: "Error reading data file.",
      });
    }

    try {
      const accounts = JSON.parse(data);
      const newAccount = req.body;

      // Add the new account to the array
      accounts.push(newAccount);

      // Write the updated accounts array back to the file
      writeFile(
        ACCOUNTS_FILE,
        JSON.stringify(accounts, null, 2),
        (writeErr) => {
          if (writeErr) {
            console.error("Error writing file:", writeErr);
            return res.status(500).json({
              status: "error",
              message: "Error saving account data.",
            });
          }

          res.status(201).json({
            status: "success",
            data: newAccount,
          });
        }
      );
    } catch (parseErr) {
      console.error("Error parsing JSON:", parseErr);
      res.status(500).json({
        status: "error",
        message: "Error parsing data file.",
      });
    }
  });
});

const readJSONFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    readFile(filePath, "utf-8", (err, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
};

// GET endpoint to fetch all applications
app.get("/applications", (req, res) => {
  readFile(APPLICATIONS_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading applications file:", err);
      return res.status(500).send("Error reading applications data");
    }
    res.json(JSON.parse(data));
  });
});

app.post(
  "/applications",
  upload.single("cvUpload"),
  async (req, res) => {
    try {
      const { userId, opportunityId } = req.body;
      const file = req.file; // Access the uploaded file
      console.log("Received application data:", {
        userId,
        opportunityId,
      });

      const date = new Date();
      const applicationDate = date.toISOString().split("T")[0];
      // Generate application data
      const newApplication = {
        application_id: `${Date.now()}`,
        user_id: userId,
        opportunity_id: opportunityId,
        application_date: applicationDate,
      };

      // Read existing applications from file
      readFile(APPLICATIONS_FILE, "utf8", (err, data) => {
        const applications = err ? [] : JSON.parse(data);

        // Add the new application
        applications.push(newApplication);

        // Write back the updated applications array
        writeFile(
          APPLICATIONS_FILE,
          JSON.stringify(applications, null, 2),
          (writeErr) => {
            if (writeErr) {
              console.error(
                "Error writing to applications file:",
                writeErr
              );
              return res.status(500).json({
                status: "error",
                message: "Failed to save application data.",
              });
            }

            console.log(
              "Application saved successfully:",
              newApplication
            );
          }
        );
      });

      // Fetch user and opportunity data
      const accounts = await readJSONFile(ACCOUNTS_FILE);
      const user = accounts.find((account) => account.id === userId);
      if (!user)
        return res.status(404).json({ error: "User not found" });

      const opportunities = await readJSONFile(OPPORTUNITIES_FILE);
      const opportunity = opportunities.find(
        (opp) => opp.id == opportunityId
      );
      if (!opportunity || !opportunity.contactPersonEmail) {
        return res
          .status(404)
          .json({ error: "Opportunity or contact email not found" });
      }

      const studentName = user.name_and_surname;
      const studentEmail = user.email;
      const universityName = user.university_name || "N/A";
      const universityLocation = user.university_location || "N/A";
      const companyEmail = opportunity.contactPersonEmail;
      const opportunityTitle = opportunity.title;

      // Email to Company employee
      const companyMailOptions = {
        from: "noreply.company.student.platform@gmail.com",
        to: companyEmail,
        subject: `New Application for ${opportunityTitle} through the Student Platform`,
        html: `<h1>New Application Received</h1>
        <h3>${studentName} has applied for <b>${opportunityTitle}</b> opportunity.</h3>
        <p><b>Applicant:</b> ${studentName} (${studentEmail})</p>
        <p><b>University:</b> ${universityName}, ${universityLocation}</p>
        <p><b>Note:</b> If provided, CV will be attached</p>`,
        attachments: file
          ? [{ path: file.path, filename: file.originalname }]
          : [],
      };

      // Email to student
      const studentMailOptions = {
        from: "noreply.company.student.platform@gmail.com",
        to: studentEmail,
        subject: `Application Confirmation for ${opportunityTitle}`,
        html: `<h1>Application Confirmation</h1>
        <h3>Thank you for applying for <b>${opportunityTitle} opportunity</b>.</h3>
        <p><b>Opportunity:</b> ${opportunityTitle}</p>
        <p><b>Contact Person Email:</b> ${companyEmail}</p>
        <p><b>Your Name:</b> ${studentName}</p>
        <p><b>Your Email:</b> ${studentEmail}</p>
        <p><b>University:</b> ${universityName}, ${universityLocation}</p>`,
        attachments: file
          ? [{ path: file.path, filename: file.originalname }]
          : [],
      };

      // Send emails
      console.log("Sending emails...");
      await transporter.sendMail(companyMailOptions);
      await transporter.sendMail(studentMailOptions);

      // Cleanup: Delete the uploaded file
      if (file) {
        const fs = require("fs");
        fs.unlink(file.path, (err) => {
          if (err) console.error("Failed to delete file:", err);
        });
      }

      res.status(200).json({ message: "Emails sent successfully!" });
      console.log(
        "Email sent succesfully!\nApplication processed successfully!"
      );
    } catch (error) {
      console.error("Error handling application:", error);
      res
        .status(500)
        .json({ error: "Error processing the application" });
    }
  }
);

// GET endpoint to fetch all world universities
app.get("/world-universities", (req, res) => {
  readFile(WU_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading world universities file:", err);
      return res
        .status(500)
        .json({ error: "Error reading data file" });
    }
    // Return the entire JSON file contents
    res.json(JSON.parse(data));
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
