const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['user', 'superadmin'], default: 'user' },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: function requiredBusiness() {
        return this.role === 'user';
      },
    },
    isActive: { type: Boolean, default: true },
    /** UPI reference / UTR provided at signup after payment step */
    signUpPaymentRef: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
