const leadEmailSubject = "Following up on your Menu Man inquiry";

export function createLeadEmailLinks(email: string) {
  const recipient = encodeURIComponent(email);
  const subject = encodeURIComponent(leadEmailSubject);

  return {
    gmail: "https://mail.google.com/mail/?view=cm&fs=1&to=" + recipient + "&su=" + subject,
    mailto: "mailto:" + recipient + "?subject=" + subject,
  };
}
