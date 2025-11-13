# 🌐 Language and Translation Contribution Guide

This document provides information about language support in PiGallery2, how users can change the language, and a guide for contributors who wish to add new translations.

---

## 1. 🌍 Supported Languages

PiGallery2 is internationalized and officially supports the following languages, based on the translation files found in the source code.

| Language Code | Language | Translation File |
| :--- | :--- | :--- |
| **cn** | Chinese (Mandarin) | `messages.cn.xlf` |
| **da** | Danish | `messages.da.xlf` |
| **de** | German | `messages.de.xlf` |
| **en** | English (Default) | `messages.en.xlf` |
| **es** | Spanish | `messages.es.xlf` |
| **fr** | French | `messages.fr.xlf` |
| **hu** | Hungarian | `messages.hu.xlf` |
| **id** | Indonesian | `messages.id.xlf` |
| **it** | Italian | `messages.it.xlf` |
| **nl** | Dutch | `messages.nl.xlf` |
| **pl** | Polish | `messages.pl.xlf` |
| **pt-br** | Portuguese (Brazil) | `messages.pt-br.xlf` |
| **ro** | Romanian | `messages.ro.xlf` |
| **ru** | Russian | `messages.ru.xlf` |
| **sk** | Slovak | `messages.sk.xlf` |
| **sv** | Swedish | `messages.sv.xlf` |

---

## 2. ⬇️ Download Guide and Resource Storage

### Download Guide

For most end-users, **no separate language files need to be downloaded**. All supported languages listed above are **bundled** into the application during the build process and included in the official PiGallery2 release.

### Where Language Resources Are Stored

The translation files (in XLIFF format) are stored within the project source code in the following directory: `src/frontend/translate/`

Each supported language has a file following the pattern `messages.[language_code].xlf` (e.g., `messages.en.xlf`).

---

## 3. ⚙️ How to Change the Language Inside PiGallery2

PiGallery2 uses the language configured in the application's **Settings** panel.

1.  Access the PiGallery2 web interface.
2.  Navigate to the **Settings** menu (usually represented by a gear icon ⚙️).
3.  Look for the **Language** option within the settings.
4.  Select the desired language from the dropdown list. The application will update the display language accordingly.

---

## 4. 📝 Guide for Contributors: How to Add New Translations

New translations and updates to existing translations are highly appreciated! Please follow these steps to contribute a new language:

### Prerequisites
You must install and run PiGallery2 from the source code, as the language creation process relies on Node Package Manager (`npm`).

### Step-by-Step

1.  **Create the XLIFF file:**
    Use the `npm run add-translation` command followed by the desired language code (e.g., use `es-mx` for Mexican Spanish or a 2-letter code like `tr` for Turkish):
    ```bash
    # Example for Turkish
    npm run add-translation -- --tr
    ```
    This command will:
    * Create the file `src/frontend/translate/messages.tr.xlf`.
    * Pre-populate the file with translation tags, often using automatic translations which **must be reviewed and corrected**.

2.  **Translate the Content:**
    Open the new XLIFF file and update every `<target>` tag with the accurate translation for the corresponding `<source>` content.

    **Example:**
    ```xml
    <trans-unit id="welcome_message" datatype="html">
        <source>Welcome to PiGallery2</source>
        <target>Welcome to PiGallery2</target> 
    </trans-unit>
    ```

3.  **Test Locally:**
    To confirm your translations work, you must rebuild the application:
    ```bash
    # Install dependencies (if not done yet)
    npm install
    # Run the build process to include your new XLIFF file
    npm run build
    # Start the app to test in your browser
    npm start 
    ```

4.  **Submit the Pull Request (PR):**
    Once tested, commit your new `messages.[code].xlf` file and the updated documentation file `docs/LANGUAGE_GUIDE.md`. Create a PR to the main PiGallery2 repository, referencing **Issue #55936**.