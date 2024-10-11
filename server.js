const express = require('express');
const multer = require('multer');
const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');



const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Save with a unique timestamp name
  },
});
const upload = multer({ storage });


// Define folder and file paths
const folderPath = path.join(__dirname, 'uploads');
const files = ['projects.json', 'contact-info.json', 'users.json'];

// Function to create folder if it doesn't exist
function createFolderIfNotExists(folder) {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
        console.log(`Folder '${folder}' created.`);
    } else {
        console.log(`Folder '${folder}' already exists.`);
    }
}

// Function to create file if it doesn't exist
function createFileIfNotExists(folder, filename) {
    const filePath = path.join(folder, filename);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([])); // Initialize with empty array or any default content
        console.log(`File '${filename}' created in folder '${folder}'.`);
    } else {
        console.log(`File '${filename}' already exists in folder '${folder}'.`);
    }
}

// Run the setup
function setup() {
    createFolderIfNotExists(folderPath); // Ensure the folder exists
    files.forEach(file => createFileIfNotExists(folderPath, file)); // Ensure each file exists
}

// Start the setup process
setup();

//-----------------------------------profile--------------------------------------------------

// Profile image handling

const uploadDir = path.join(__dirname, 'uploads');
const profilepath = path.join(uploadDir, 'users.json');

// Ensure the uploads directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Ensure the users.json file exists
if (!fs.existsSync(profilepath)) {
    fs.writeFileSync(profilepath, JSON.stringify([])); // Initialize with an empty array
}

// Route to upload profile picture
app.post('/upload-profile-picture', upload.single('profilePicture'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log('Uploaded file:', req.file);

  const profilePicture = req.file;
  const userData = { profilePicture: profilePicture.filename };

  try {
    const data = await fsp.readFile(profilepath, 'utf8');
    const users = JSON.parse(data);

    // Logic for deleting the previous profile picture (if any)
    if (users.length > 0 && users[users.length - 1].profilePicture) {
      const oldProfilePath = path.join(folderPath, users[users.length - 1].profilePicture);
      try {
        await fsp.access(oldProfilePath);
        await fsp.unlink(oldProfilePath);
      } catch (err) {
        console.warn('Old profile picture not found or already deleted:', oldProfilePath);
      }
    }

    users.push(userData);
    await fsp.writeFile(profilepath, JSON.stringify(users, null, 2));
    res.status(200).json(userData);
  } catch (err) {
    console.error('Error handling profile picture upload:', err);
    res.status(500).json({ error: 'Server error while processing the request' });
  }
});


// Route to get the latest profile picture
app.get('/get-profile-picture', async (req, res) => {
  try {
    const data = await fsp.readFile(profilepath, 'utf8');
    const users = JSON.parse(data);

    if (users.length > 0) {
      const profilePicture = users[users.length - 1].profilePicture;
      res.status(200).json({ profilePicture });
    } else {
      res.status(404).json({ error: 'No profile picture found' });
    }
  } catch (err) {
    console.error('Error retrieving profile picture:', err);
    res.status(500).json({ error: 'Server error while retrieving the profile picture' });
  }
});

//-----------------------------------project--------------------------------------------------

//project

const projectsFile = path.join(__dirname,'uploads' ,'projects.json');
let projects = [];
if (fs.existsSync(projectsFile)) {
  projects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
}



// Route to upload project details and an image
app.post('/upload/project', upload.single('image'), (req, res) => {
  const { title, technology, description, Url } = req.body;
  const newProject = {
    title,
    technology,
    description,
    image: req.file.filename, // Save the file name
    Url,
  };

  // Add the project to the array
  projects.push(newProject);

  // Save the projects array to JSON file
  fs.writeFileSync(projectsFile, JSON.stringify(projects));

  res.json({ message: 'Project uploaded successfully!', project: newProject });
});

// Endpoint to get all projects
app.get('/projects', (req, res) => {
  res.json(projects);
});


//-----------------------------------resume--------------------------------------------------

// Resume handling
const resumePath = path.join(__dirname, 'uploads', 'resume.pdf');

// Route to upload and update the resume (replace previous one)
app.post('/upload/resume', upload.single('resume'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No resume file uploaded' });
  }

  // Delete the previous resume if it exists
  if (fs.existsSync(resumePath)) {
    fs.unlinkSync(resumePath);
  }

  // Move the uploaded file to the correct path and rename it to 'resume.pdf'
  fs.renameSync(req.file.path, resumePath);

  res.json({ message: 'Resume uploaded and updated successfully!' });
});

// Serve the resume URL
app.get('/get-resume-url', (req, res) => {
  res.json({ url: '/uploads/resume.pdf' });
});


//Download resume
app.get('/uploads/resume.pdf', (req, res) => {
  res.set('Access-Control-Allow-Origin', `${process.env.FRONTEND_URL}`); 
  res.download(resumePath, 'resume.pdf', (err) => {
    if (err) {
      console.error('Error while downloading file:', err);
      res.status(500).send('File not found');
    }
  });
});

//-----------------------------------mail--------------------------------------------------

// Function to send email
require('dotenv').config();
const filePath = path.join(__dirname,'uploads', 'contact-info.json');

// Function to read the contact-info.json file
const getContacts = () => {
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath);
    return JSON.parse(data);
  }
  return [];
};

// Function to save contact information
const saveContacts = (contacts) => {
  fs.writeFileSync(filePath, JSON.stringify(contacts, null, 2));
};

// Function to send email using Nodemailer
const sendEmail = (contactInfo, res) => {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,  // Access the GMAIL_USER variable
      pass: process.env.GMAIL_PASS,  // Access the GMAIL_PASS variable
    },
  });

  let mailOptions = {
    from:  process.env.GMAIL_USER,
    to: 'sanjay.manikandan.dev@gmail.com',
    subject: 'New Contact Form Submission',
    text: `New contact details received:
    Name: ${contactInfo.name}
    Phone: ${contactInfo.phone}
    Email: ${contactInfo.email}
    Message: ${contactInfo.message}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error occurred while sending email:', error);
      res.status(500).send('Failed to send email');
    } else {
      console.log('Email sent successfully:', info.response);
      res.send('Email has been sent successfully!');
    }
  });
};

// Route to handle contact form submissions
app.put('/contact', (req, res) => {
  const contactInfo = req.body;

  console.log('Received contact info:', contactInfo);

  try {
    // Read current contacts
    const contacts = getContacts();

    // Add new contact
    contacts.push(contactInfo);

    // Save contacts
    saveContacts(contacts);

    // Send email
    sendEmail(contactInfo, res);
  } catch (error) {
    console.error('Error handling contact submission:', error);
    res.status(500).send('Server error');
  }
});


//test

app.get("/name",(req,res)=>{
  res.status(200).send("Sanjay");
});

//-----------------------------------server--------------------------------------------------

const PORT=process.env.PORT || 9000

app.listen(PORT, () => {
  console.log(`Server running on ${process.env.REACT_APP_API_URL}`);
});