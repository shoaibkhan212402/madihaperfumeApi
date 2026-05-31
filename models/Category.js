import mongoose from 'mongoose';

const categorySchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    image: { type: String },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    seoTitle: { type: String },
    seoDescription: { type: String },
    seoKeywords: { type: String },
  },
  { timestamps: true }
);

const Category = mongoose.model('Category', categorySchema);
export default Category;
