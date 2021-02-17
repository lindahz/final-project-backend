import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'

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
    trim: true,
    required: true,
    minlength: 5,
    maxlength: 300
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  name: {
    type: String,
    trim: true,
    required: true,
    minlength: 2,
    maxlength: 26
  },
  title: {
    type: String,
    trim: true,
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

const port = process.env.PORT || 8080
const app = express()

app.use(cors())
app.use(bodyParser.json())


app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next()
  } else {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

app.get('/', (req, res) => {
  res.send('API for health clinics in Sweden. Go to https://github.com/lindahz/final-project-backend/ for documentation.')
})

app.get('/clinics', async (req, res) => {
  try {
    const { search } = req.query
    const queryRegex = new RegExp(search, 'i') 
    const sortField = req.query.sortField
    const sortOrder = req.query.sortOrder || 'asc'
    const pageSize = req.query.pageSize
    const pageNum = req.query.pageNum

    const skips = pageSize * (pageNum - 1)

    let databaseQuery = Clinic.find({ $or:[{ region: queryRegex }, { address: queryRegex }] }).populate('reviews')

    if (sortField) {
      databaseQuery = databaseQuery.sort({ 
        [sortField]: sortOrder === 'asc' ? 1 : -1
      })
    }

    const totalResults = await Clinic.find({ $or:[{ region: queryRegex }, { address: queryRegex }] }).countDocuments() 
    const results = await databaseQuery.skip(skips).limit(+pageSize)

    res.status(200).json({ clinics: results, total_results: totalResults })
    } catch (err) {
      res.status(400).json({ success: false, error: err.errors })
    }
  })

app.get('/clinics/:id', async (req, res) => {
  try {
    const { id } = req.params

    const clinic = await Clinic.findById(id).populate('reviews')

    res.status(200).json(clinic)
  } catch (err) {
    res.status(404).json({ success: false, error: err.errors })
  }
})

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
      { _id: id }, { 
        $inc: { text_reviews_count: 1 },
        $push: { reviews: savedReview },
        $set: { average_rating: calculatedAverage.toFixed(1) } 
      }
    ) 

    res.status(201).json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, error: err.errors })
  }
})

app.get('/clinics/reviews', async (req, res) => {
  try {
    const pageSize = req.query.pageSize
    const pageNum = req.query.pageNum

    const skips = pageSize * (pageNum - 1)

    const reviews = await Review.find().sort({ review_date: 'desc' }).skip(skips).limit(+pageSize)

    res.status(200).json(reviews)
  } catch (err) {
    res.status(400).json({ success: false, error: err.errors })
  }
})

app.get('/clinics/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params
    const pageSize = req.query.pageSize
    const pageNum = req.query.pageNum

    const skips = pageSize * (pageNum - 1)

    const reviews = await Review.find({ clinic_id: id }).skip(skips).limit(+pageSize)

    res.status(200).json(reviews)
  } catch {
    res.status(404).json({ success: false, error: err.errors })
  }
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
