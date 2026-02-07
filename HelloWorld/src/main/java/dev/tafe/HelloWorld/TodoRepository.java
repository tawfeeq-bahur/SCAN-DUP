package dev.tafe.HelloWorld;

import dev.tafe.HelloWorld.model.Todo;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TodoRepository extends JpaRepository<Todo, Long> {
}