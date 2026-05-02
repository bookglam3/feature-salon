import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendBookingConfirmationEmail = async (
  to: string,
  clientName: string,
  serviceName: string,
  salonName: string,
  dateTime: string,
  staffName?: string
) => {
  const subject = `Booking Confirmed - ${salonName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F6EF7;">Booking Confirmed!</h2>
      <p>Hi ${clientName},</p>
      <p>Your booking has been confirmed at ${salonName}.</p>
      <div style="background: #F8F9FC; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0F172A;">Booking Details:</h3>
        <p><strong>Service:</strong> ${serviceName}</p>
        <p><strong>Date & Time:</strong> ${new Date(dateTime).toLocaleString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
        ${staffName ? `<p><strong>Staff:</strong> ${staffName}</p>` : ''}
      </div>
      <p>If you need to make any changes, please contact us directly.</p>
      <p>Thank you for choosing ${salonName}!</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
};

const sendSalonNotificationEmail = async (
  salonEmail: string,
  salonName: string,
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  serviceName: string,
  dateTime: string,
  staffName?: string
) => {
  const subject = `New Booking - ${salonName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F6EF7;">New Booking Received!</h2>
      <p>A new booking has been made at ${salonName}.</p>
      <div style="background: #F8F9FC; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0F172A;">Client Details:</h3>
        <p><strong>Name:</strong> ${clientName}</p>
        <p><strong>Email:</strong> ${clientEmail}</p>
        <p><strong>Phone:</strong> ${clientPhone}</p>
        <h3 style="color: #0F172A;">Booking Details:</h3>
        <p><strong>Service:</strong> ${serviceName}</p>
        <p><strong>Date & Time:</strong> ${new Date(dateTime).toLocaleString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
        ${staffName ? `<p><strong>Staff:</strong> ${staffName}</p>` : ''}
      </div>
      <p>Please confirm this booking in your dashboard.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: salonEmail,
    subject,
    html,
  });
};

export async function POST(request: NextRequest) {
  try {
    const {
      appointmentId,
      clientEmail,
      clientName,
      serviceName,
      dateTime,
      staffName,
      salonName,
      clientPhone,
      salonOwnerEmail,
    } = await request.json();

    // Send confirmation email to client
    await sendBookingConfirmationEmail(
      clientEmail,
      clientName,
      serviceName,
      salonName,
      dateTime,
      staffName
    );

    // Send notification to salon owner if email provided
    if (salonOwnerEmail) {
      await sendSalonNotificationEmail(
        salonOwnerEmail,
        salonName,
        clientName,
        clientEmail,
        clientPhone,
        serviceName,
        dateTime,
        staffName
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending booking emails:', error);
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }
}