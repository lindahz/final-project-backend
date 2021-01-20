import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose, { Schema } from 'mongoose'

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
  },
  reviews: [{ // not sure if this is needed? 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }]
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
  clinic_id: {
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

// GET requests to display clinic data - Not working correctly - should only be able to query on region and address
app.get('/clinics', async (req, res) => {
  try {
    const clinics = await Clinic.find(req.query)
    res.json(clinics)
  } catch (err) {
    res.status(404).json({ message: 'Could not find any clinics', error: err.errors })
  }
})

// by region/location
// by clinic type
// filter/sort?
// pagination

// POST requests to add clinic data
// POST request to delete clinic data
// POST request to modify clinic data

// POST request reviews for a certain clinic
app.post('/clinics/:id/review', async (req, res) => { // watch Van week 19, 53.00
  try {
    const { id } = req.params
    const { review, rating, name, clinic_id } = req.body
    const savedReview = await new Review({ review, rating, name, clinic_id }).save()
    await Clinic.updateOne({ _id: id }, { $inc : {'text_reviews_count': 1} })
    res.status(201).json(savedReview)
  } catch (err) {
    res.status(404).json({ message: 'Could not create review', error: err.errors })
  }
})

// GET request to display all reviews - PAGINATION MISSING
app.get('/clinics/reviews', async (req, res) => {
  const reviews = await Review.find().sort({ review_date: 'desc' }).exec()
  res.json(reviews)
})

// GET requests to display reviews by ID 
app.get('/clinics/:id/reviews', async (req, res) => {
  const { id } = req.params
  const reviews = await Review.find({ clinic_id: id })
  res.json(reviews)
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
