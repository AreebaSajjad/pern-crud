// Password reset email ka HTML template. Har forgot-password request par
// yehi template use hota hai — sirf code aur user ka naam badalta hai.
const resetPasswordEmail = ({ name, code, companyName, expiryMinutes }) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password</title>
  </head>
  <body style="margin:0; padding:0; background-color:#e8ecf3; font-family:'Segoe UI', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8ecf3; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#4a90e2; padding:24px 32px;">
                <span style="color:#ffffff; font-size:20px; font-weight:700; letter-spacing:0.3px;">${companyName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 12px; color:#2d2d2d; font-size:20px;">Reset your password</h2>
                <p style="margin:0 0 16px; color:#444; font-size:14px; line-height:1.6;">
                  Hi ${name || 'there'},
                </p>
                <p style="margin:0 0 24px; color:#444; font-size:14px; line-height:1.6;">
                  We received a request to reset the password for your ${companyName} account.
                  Use the code below to set a new password. This code is valid for
                  ${expiryMinutes} minutes.
                </p>
                <div style="text-align:center; margin:0 0 24px;">
                  <span style="display:inline-block; background:#f4f5f7; border:1px dashed #4a90e2; border-radius:8px; padding:14px 28px; font-size:28px; font-weight:700; letter-spacing:8px; color:#2d2d2d;">
                    ${code}
                  </span>
                </div>
                <p style="margin:0 0 8px; color:#777; font-size:13px; line-height:1.6;">
                  If you didn't request this, you can safely ignore this email — your password
                  will remain unchanged.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f4f5f7; padding:16px 32px; text-align:center;">
                <span style="color:#999; font-size:12px;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

module.exports = { resetPasswordEmail };
