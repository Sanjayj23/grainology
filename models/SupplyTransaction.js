import mongoose from 'mongoose';

const supplyTransactionSchema = new mongoose.Schema({
  // Transaction Info
  transaction_date: {
    type: Date,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  
  // Supplier Info
  supplier_name: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  
  // Warehouse Info
  warehouse_name: {
    type: String,
    required: true
  },
  chamber_no: {
    type: String
  },
  
  // Commodity Info
  commodity: {
    type: String,
    required: true
  },
  variety: {
    type: String,
    required: true
  },
  
  // Logistics Info
  gate_pass_no: String,
  vehicle_no: String,
  weight_slip_no: String,
  
  // Weight Info
  gross_weight_mt: Number, // Gross Weight in MT (Vehicle + Goods)
  tare_weight_mt: Number, // Tare Weight of Vehicle
  no_of_bags: Number,
  net_weight_mt: {
    type: Number,
    required: true
  },
  
  // Financial Info
  rate_per_mt: {
    type: Number,
    required: true
  },
  gross_amount: {
    type: Number,
    required: true
  },
  
  // Quality Parameters
  hlw_wheat: Number, // HLW (Hectolitre Weight) in Wheat
  excess_hlw: Number,
  deduction_amount_hlw: Number,
  
  moisture_moi: Number, // Moisture (MOI)
  excess_moisture: Number,
  
  bddi: Number, // Broken, Damage, Discolour, Immature
  excess_bddi: Number,
  moi_bddi: Number, // MOI+BDDI
  
  weight_deduction_kg: Number, // Weight Deduction in KG
  deduction_amount_moi_bddi: Number, // Deduction Amount Rs. (MOI+BDDI)
  
  // Other Deductions (10 columns)
  other_deductions: {
    type: [Number],
    default: []
  },
  
  // Final Amount
  net_amount: {
    type: Number,
    required: true
  },
  
  // Additional Info
  remarks: String,
  
  // Reference to user if needed
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better query performance
supplyTransactionSchema.index({ transaction_date: -1 });
supplyTransactionSchema.index({ supplier_name: 1 });
supplyTransactionSchema.index({ commodity: 1 });
supplyTransactionSchema.index({ state: 1 });
supplyTransactionSchema.index({ warehouse_name: 1 });

const SupplyTransaction = mongoose.model('SupplyTransaction', supplyTransactionSchema);

export default SupplyTransaction;

