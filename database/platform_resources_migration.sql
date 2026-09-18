USE imboni_hub;

CREATE TABLE IF NOT EXISTS platform_resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    file_path VARCHAR(255),
    resource_url VARCHAR(500),
    published BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO platform_resources (title, category, description, created_by)
SELECT catalog.title, catalog.category, catalog.description, u.id
FROM (
    SELECT 'Computer Fundamentals' title, 'Digital Skills' category, 'Hardware, operating systems, files, productivity, and safe internet use.' description
    UNION ALL SELECT 'Office Productivity', 'Digital Skills', 'Word processing, spreadsheets, presentations, email, and collaboration.'
    UNION ALL SELECT 'Programming Fundamentals', 'Programming', 'Logic, algorithms, problem solving, Git, and software development.'
    UNION ALL SELECT 'Python Programming', 'Programming', 'Python syntax, functions, object-oriented programming, and automation.'
    UNION ALL SELECT 'JavaScript and Web Development', 'Programming', 'JavaScript, HTML, CSS, browser APIs, and responsive web development.'
    UNION ALL SELECT 'React Frontend Development', 'Software Development', 'Components, state, routing, forms, and accessible React applications.'
    UNION ALL SELECT 'Backend Development with Node.js', 'Software Development', 'Express APIs, authentication, validation, and backend development.'
    UNION ALL SELECT 'Mobile App Development', 'Software Development', 'Mobile user experience and cross-platform application development.'
    UNION ALL SELECT 'Data Structures and Algorithms', 'Computer Science', 'Data structures, algorithm analysis, and problem solving.'
    UNION ALL SELECT 'Computer Networking', 'Networking', 'TCP/IP, addressing, routing, switching, wireless, and troubleshooting.'
    UNION ALL SELECT 'CCNA Preparation', 'Networking', 'Cisco fundamentals, VLANs, routing, WANs, and security basics.'
    UNION ALL SELECT 'Linux System Administration', 'Systems', 'Linux commands, permissions, services, shell scripting, and servers.'
    UNION ALL SELECT 'Windows Server Administration', 'Systems', 'Active Directory, networking services, policies, and server management.'
    UNION ALL SELECT 'Cybersecurity Fundamentals', 'Cybersecurity', 'Threats, vulnerabilities, controls, risk, and defensive practices.'
    UNION ALL SELECT 'Ethical Hacking', 'Cybersecurity', 'Reconnaissance, vulnerability assessment, secure testing, and disclosure.'
    UNION ALL SELECT 'Digital Forensics', 'Cybersecurity', 'Evidence handling, incident response, logs, and investigation.'
    UNION ALL SELECT 'Database Design and SQL', 'Data and Databases', 'Relational modeling, SQL, normalization, and transactions.'
    UNION ALL SELECT 'MySQL Database Administration', 'Data and Databases', 'MySQL setup, users, backups, indexes, performance, and recovery.'
    UNION ALL SELECT 'Data Analysis with Excel', 'Data and Analytics', 'Formulas, pivot tables, dashboards, and data-driven decisions.'
    UNION ALL SELECT 'Data Analysis with Python', 'Data and Analytics', 'Pandas, NumPy, visualization, cleaning, and reproducible analysis.'
    UNION ALL SELECT 'Artificial Intelligence and Machine Learning', 'AI and Emerging Tech', 'AI concepts, learning, evaluation, and responsible use.'
    UNION ALL SELECT 'Cloud Computing Fundamentals', 'Cloud and DevOps', 'Cloud concepts, service models, deployment, identity, and costs.'
    UNION ALL SELECT 'DevOps and CI/CD', 'Cloud and DevOps', 'Git workflows, testing, pipelines, containers, and deployment.'
    UNION ALL SELECT 'UI/UX and Product Design', 'Design', 'User research, wireframes, usability, prototyping, and inclusive design.'
    UNION ALL SELECT 'IT Project Management', 'Professional Skills', 'Agile methods, planning, documentation, teamwork, and delivery.'
    UNION ALL SELECT 'Technical Support and IT Service Management', 'Professional Skills', 'Troubleshooting, help desk practice, service management, and documentation.'
) catalog
JOIN users u ON u.email = 'admin@imboni.rw'
WHERE NOT EXISTS (SELECT 1 FROM platform_resources existing WHERE existing.title = catalog.title);

UPDATE platform_resources SET resource_url = CASE title
    WHEN 'Computer Fundamentals' THEN 'https://learn.microsoft.com/training/browse/?terms=computer%20basics'
    WHEN 'Office Productivity' THEN 'https://support.microsoft.com/training'
    WHEN 'Programming Fundamentals' THEN 'https://www.kaggle.com/learn/intro-to-programming'
    WHEN 'Python Programming' THEN 'https://www.kaggle.com/learn/python'
    WHEN 'JavaScript and Web Development' THEN 'https://developer.mozilla.org/en-US/docs/Learn_web_development'
    WHEN 'React Frontend Development' THEN 'https://www.freecodecamp.org/learn/front-end-development-libraries-v9/'
    WHEN 'Backend Development with Node.js' THEN 'https://www.freecodecamp.org/learn/back-end-development-and-apis-v9/'
    WHEN 'Mobile App Development' THEN 'https://developer.android.com/courses'
    WHEN 'Data Structures and Algorithms' THEN 'https://www.freecodecamp.org/learn/coding-interview-prep/'
    WHEN 'Computer Networking' THEN 'https://www.netacad.com/courses/networking'
    WHEN 'CCNA Preparation' THEN 'https://www.netacad.com/courses/ccna'
    WHEN 'Linux System Administration' THEN 'https://www.freecodecamp.org/news/learn-linux-for-beginners-book-basic-to-advanced/'
    WHEN 'Windows Server Administration' THEN 'https://learn.microsoft.com/training/browse/?terms=Windows%20Server'
    WHEN 'Cybersecurity Fundamentals' THEN 'https://skillsbuild.org/students/course-catalog/cybersecurity'
    WHEN 'Ethical Hacking' THEN 'https://www.coursera.org/browse/information-technology/cybersecurity'
    WHEN 'Digital Forensics' THEN 'https://www.coursera.org/browse/information-technology/cybersecurity'
    WHEN 'Database Design and SQL' THEN 'https://www.kaggle.com/learn/intro-to-sql'
    WHEN 'MySQL Database Administration' THEN 'https://dev.mysql.com/doc/'
    WHEN 'Data Analysis with Excel' THEN 'https://support.microsoft.com/training'
    WHEN 'Data Analysis with Python' THEN 'https://www.kaggle.com/learn/pandas'
    WHEN 'Artificial Intelligence and Machine Learning' THEN 'https://www.kaggle.com/learn/intro-to-machine-learning'
    WHEN 'Cloud Computing Fundamentals' THEN 'https://learn.microsoft.com/training/'
    WHEN 'DevOps and CI/CD' THEN 'https://www.freecodecamp.org/news/learn-continuous-integration-delivery-and-deployment/'
    WHEN 'UI/UX and Product Design' THEN 'https://www.coursera.org/learn/foundations-user-experience-design'
    WHEN 'IT Project Management' THEN 'https://skillsbuild.org/learn-with-ibm-bob'
    WHEN 'Technical Support and IT Service Management' THEN 'https://skillsbuild.org/learning-catalog'
    ELSE resource_url
END
WHERE resource_url IS NULL;
