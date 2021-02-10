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
  drop_in: String,
  text_reviews_count: { 
    type: Number,
    default: 0
  },
  average_rating: {
    type: Number,
    default: 0
  },
  reviews: [{ 
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
    max: 5
  },
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 26
  },
  title: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 60
  },
  review_date: {
    type: Date,
    default: Date.now
  },
  clinic_id: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Clinic",
    required: true
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
  res.send('API for health clinics in Sweden. Go to https://github.com/lindahz/final-project-backend/ for documentation.')
})

// TO DO:s

// correct error messages for catch - NOT COMPLETED
// add regex function for empty spaces in search query - NOT COMPLETED
// add server error message - NOT COMPLETED 

// GET requests to display clinic data 
app.get('/clinics', async (req, res) => {
  try {
    const { search } = req.query
    const queryRegex = new RegExp(search, 'i') // add regex for empty spaces
    const sortField = req.query.sortField
    const sortOrder = req.query.sortOrder || 'asc'
    const pageSize = req.query.pageSize
    const pageNum = req.query.pageNum
    const skips = pageSize * (pageNum - 1)

    console.log(`GET/clinics?search=${search}&sortField=${sortField}&sortOrder=${sortOrder}&pageSize=${pageSize}&pageNum=${pageNum}`) // How the URL will look like 

    let databaseQuery = Clinic.find({ $or:[{ region: queryRegex }, { address: queryRegex }] }).populate('reviews')

    if (sortField) {
      databaseQuery = databaseQuery.sort({ 
        [sortField]: sortOrder === 'asc' ? 1 : -1
      })
    }

    const results = await databaseQuery.skip(skips).limit(+pageSize)
    const totalResults = await Clinic.find({ $or:[{ region: queryRegex }, { address: queryRegex }] }).countDocuments().exec()
    
    res.status(200).json({ clinics: results, total_results: totalResults })

    } catch (err) {
      res.status(400).json({ success: false, error: err.errors })
    }
  })

// GET request to display a clinic by ID
app.get('/clinic/:id', async (req, res) => {
  try {
    const { id } = req.params
    const clinic = await Clinic.findById(id).populate('reviews')
    res.status(200).json(clinic)
  } catch (err) {
    res.status(400).json({ message: 'Could not find clinic with matching id', error: err.errors })
  }
})

// POST request reviews for a certain clinic
app.post('/clinics/:id/review', async (req, res) => {
  try {
    const { id } = req.params
    const { review, rating, name, clinic_id, title } = req.body
    const savedReview = await new Review({ review, rating, name, title, clinic_id }).save()
    const allReviewsForClinic = await Review.find({ clinic_id })
    let total = 0
    for (let i = 0; i < allReviewsForClinic.length; i++) {
      total += allReviewsForClinic[i].rating;
    }
    const calculatedAverage = total / allReviewsForClinic.length
    await Clinic.updateOne(
      { _id: id }, { $inc: { text_reviews_count: 1 }, $push: { reviews: savedReview }, $set: { average_rating: calculatedAverage.toFixed(1) } } ) 
    res.status(201).json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, error: err.errors })
  }
})

// GET request to display all reviews
app.get('/clinics/reviews', async (req, res) => {
  try {
    const pageSize = req.query.pageSize
    const pageNum = req.query.pageNum
    const skips = pageSize * (pageNum - 1)

    console.log(`GET/clinics/reviews?pageSize=${pageSize}&pageNum=${pageNum}`) // How the URL will look like 

    const reviews = await Review.find().sort({ review_date: 'desc' }).skip(skips).limit(+pageSize)
    res.status(200).json(reviews)
  } catch (err) {
    res.status(400).json({ message: 'Could not find reviews', error: err.errors })
  }
})

// GET requests to display reviews by clinic ID 
app.get('/clinic/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params
    const pageSize = req.query.pageSize
    const pageNum = req.query.pageNum
    const skips = pageSize * (pageNum - 1)

    const reviews = await Review.find({ clinic_id: id }).skip(skips).limit(+pageSize)
    res.status(200).json(reviews)
  } catch {
    res.status(400).json({ message: 'Could not find reviews', error: err.errors })
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
