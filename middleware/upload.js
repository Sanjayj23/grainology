import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory

const fileFilter = (req, file, cb) => {
  // Accept CSV and Excel files
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  const ext = path.extname(file.originalname).toLowerCase();
  const isValidExt = ['.csv', '.xlsx', '.xls'].includes(ext);
  
  if (allowedTypes.includes(file.mimetype) || isValidExt) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Please upload CSV or Excel (.xlsx, .xls) files only.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export default upload;

