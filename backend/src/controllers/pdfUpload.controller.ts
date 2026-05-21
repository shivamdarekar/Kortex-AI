import type { Request, Response } from "express";

export const uploadPdfController = (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: "No PDF file uploaded. Use form-data key: pdf",
    });
    return;
  }

  res.status(201).json({
    success: true,
    message: "PDF uploaded successfully",
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    },
  });
};
