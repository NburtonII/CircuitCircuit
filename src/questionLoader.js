class questionLoader{
    //This loads questions from a specified source such as a json file.
    //Later on it should accept this file from a user upload or from a server.
    constructor(path = null, questionList = null){
        if(!path && !questionList){
            this.questions = [
        {
            question: "What is the fastest Big O time?",
            answer: "O(logN)",
            wrongAnswers: ["O(n)","O(N^2)", "O(2^n)"]
        },
        {
            question: "which search sorting algorithm is the slowest?",
            answer: "QuickSort",
            wrongAnswers: ["Bubble Sort","Shell sort", "Selection Sort"] 
        },
        ];
        }   else if(questionList){
            this.questions = questionList;
        }
        else{
            fetch(path)
            .then(response => response.json())
            .then(data => {
                this.questions = data;
            })
            .catch(error => {
                console.error("Error loading questions:", error);
                this.questions = [];
            });
    }
    }
}