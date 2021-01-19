import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'

import clinicData from './data/clinic-data.json'

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/healthFinder"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const Clinic = new mongoose.model('Clinic', {
  region: String,
  clinic_operation: String,
  clinic_type: String,
  clinic_name: String,
  address: String,
  open_hours: String,
  text_reviews_count: { 
    type: Number,
    default: 0
  }
})

const Review = mongoose.model('Review', {
  review: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 140
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  name: {
    type: String,
    required: true
  },
  review_date: {
    type: Date,
    default: Date.now
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Clinic"
  }
})

// Use RESET_DATABASE = true in Heruko to reset
if (process.env.RESET_DATABASE) {
  console.log('Resetting database!')
  const seedDatabase = async () => {
    await Clinic.deleteMany({}) 
    clinicData.forEach(async clinicData => {
      await new Clinic(clinicData).save()
    })
  }
  seedDatabase()
}

// Defines the port the app will run on
const port = process.env.PORT || 8080
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

// HERE GOES THE ROUTES

app.get('/', (req, res) => {
  res.send('This is my final project API')
})

// GET requests to display clinic data
// by region/location
// by clinic type
// filter/sort?
// pagination

// POST requests to add clinic data
// POST request to delete clinic data
// POST request to modify clinic data

// POST request to perform reviews on certain clinics
app.post('/clinics/:id/review', async (req, res) => { // watch Van week 19, 53.00
  try {
    const { id } = req.params
    const { review, rating, name } = req.body
    const savedReview = await new Review({ review, rating, name }).save()
    await Clinic.updateOne({ _id: id }, { $inc : {'text_reviews_count': 1} })
    res.status(201).json(savedReview)
  } catch (err) {
    res.status(404).json({ message: 'Could not create review', error: err.errors })
  }
})

// GET requests to display reviews  

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
