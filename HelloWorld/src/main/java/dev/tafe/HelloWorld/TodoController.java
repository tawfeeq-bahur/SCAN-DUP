package dev.tafe.HelloWorld;

import dev.tafe.HelloWorld.model.Todo;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/todos")
public class TodoController {

    private final TodoService todoService;

    public TodoController(TodoService todoService)
    {
        this.todoService = todoService;
    }

    @PostMapping
    public Todo createTodo(@RequestBody Todo todo)
    {
        return todoService.createTodo(todo);
    }

    @GetMapping
    public List<Todo> getAllTodos()
    {
        return todoService.getAllTodos();
    }

    @GetMapping("/{id}")
    public Todo getTodo(@PathVariable Long id)
    {
        return todoService.getTodoById(id);
    }

    @DeleteMapping("/{id}")
    public String deleteTodo(@PathVariable Long id)
    {
        todoService.deleteTodo(id);
        return "Todo deleted successfully";
    }




}
