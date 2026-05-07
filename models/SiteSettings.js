import mongoose from 'mongoose';

const siteStatSchema = new mongoose.Schema(
  {
    value: { type: Number, default: 0 },
    prefix: { type: String, default: '' },
    suffix: { type: String, default: '' },
    label: { type: String, required: true, trim: true },
    text: { type: String, default: '', trim: true }
  },
  { _id: false }
);

const contactItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    lines: { type: [String], default: [] }
  },
  { _id: false }
);

const businessHoursSchema = new mongoose.Schema(
  {
    heading: { type: String, default: 'Business hours', trim: true },
    primary: { type: String, default: 'Monday to Friday: 9:00 AM to 6:00 PM', trim: true },
    secondary: { type: String, default: 'Saturday: 10:00 AM to 4:00 PM', trim: true }
  },
  { _id: false }
);

const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'global' },
    contactDetails: {
      type: [contactItemSchema],
      default: [
        { key: 'email', title: 'Email', lines: ['support@grainology.com', 'info@grainology.com'] },
        { key: 'phone', title: 'Phone', lines: ['+91 1800-XXX-XXXX', '+91 1800-XXX-XXXX (Toll Free)'] },
        { key: 'address', title: 'Address', lines: ['India'] }
      ]
    },
    businessHours: { type: businessHoursSchema, default: () => ({}) },
    homepageStats: {
      type: [siteStatSchema],
      default: [
        {
          value: 50,
          prefix: '',
          suffix: 'K+',
          label: 'Active Users',
          text: 'A growing network of platform participants uses Grainology for trade discovery, workflows, and operations.'
        },
        {
          value: 500,
          prefix: '₹',
          suffix: 'Cr+',
          label: 'Trade Volume',
          text: 'Trade activity across the platform reflects large-scale commodity movement and recurring business usage.'
        },
        {
          value: 1000,
          prefix: '',
          suffix: '+',
          label: 'Cities Covered',
          text: 'Users can engage with Grainology across a wide geographic footprint spanning multiple agricultural markets.'
        },
        {
          value: 24,
          prefix: '',
          suffix: '/7',
          label: 'Support',
          text: 'Teams can rely on continuous assistance for platform operations, onboarding, and issue resolution.'
        }
      ]
    }
  },
  { timestamps: true }
);

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);

export default SiteSettings;
