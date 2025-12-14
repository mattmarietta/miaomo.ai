import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    //Get the FormData object from the request
    const formData = await request.formData();
    const file = formData.get('file');

    //Validate the file
    if (!file || typeof file === 'string' || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file received.' }, { status: 400 });
    }

    //Convert the file to a buffer (required for writing to disk)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    //Define the path where the file will be saved
    const filename = file.name.replaceAll(' ', '_');
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', filename);

    //Write the file to the disk (This is the "saving" step)
    await writeFile(uploadPath, buffer);

    //Return a success response
    return NextResponse.json({
      Message: 'File uploaded successfully',
      filename: filename,
      path: `/uploads/${filename}`
    }, { status: 201 });

  } catch (error) {
    console.error('Error occurred during file upload:', error);
    return NextResponse.json({
      error: 'Internal Server Error during upload processing'
    }, { status: 500 });
  }
}