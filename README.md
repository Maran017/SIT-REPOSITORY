## to setup the project....

1. MongoDB Community Server*

This acts as the database for user accounts and metadata.

* *Step:* [Download MongoDB Community Server here](https://www.mongodb.com/try/download/community)
* *Installation Procedure:*
* Choose the *"Complete"* installation type.
* Keep the default "Service Configuration" settings.
* *IMPORTANT:* Ensure the box *"Install MongoDB Compass"* is checked at the end.

* *Verify:* Open *MongoDB Compass, click *"Connect"**, and ensure you see the local databases.

2. Ghostscript (64-bit)*

This is the specialized tool the app uses to compress and process PDFs.

* *Step:* [Download Ghostscript AGPL Release here](https://ghostscript.com/releases/gsdnld.html)
* *Installation Procedure:*
* Look for the link labeled *"Ghostscript for Windows (64 bit)"* and download.
* Install it (usually installs to C:\Program Files\gs\gs10.xx.x).


* *Environmental Variable Setup:*
* Search for *"Environment Variables"* in your Windows search bar.
* Under *System Variables, find **Path* and click *Edit*.
* Click *New* and paste the path to the bin folder (e.g., C:\Program Files\gs\gs10.02.1\bin).
* Click *OK* on all windows.

3. add an .env file in the backend folder...
in the .env file,
{MONGO_URI= your mongodb local host name,
GMAIL_APP_PASSWORD= inside souble quotaion add the 16 letters gmail passkey
ADMIN_USERNAME= inside the double quotation add the admin username here..this is the admin username.
ADMIN_PASSWORD= inside the double quotation add the admin password here..this is the admin password.}

 
