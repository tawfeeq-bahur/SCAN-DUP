package dev.tafe.HelloWorld;

import dev.tafe.HelloWorld.model.Todo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TodoService
{
    private final TodoRepository todoRepository ;

    public TodoService(TodoRepository todoRepository)
    {
        this.todoRepository = todoRepository;
    }

    //create / save Todo
    public Todo createTodo(Todo todo)
    {
        return todoRepository.save(todo);
    }

    public List<Todo> getAllTodos()
    {
        return todoRepository.findAll();
    }

    public Todo getTodoById(Long id)
    {
        return todoRepository.findById(id).orElse(null);
    }

    public void deleteTodo(Long id)
    {
        todoRepository.deleteById(id);
    }


}