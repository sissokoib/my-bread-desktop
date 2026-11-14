import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { CommandesComponent } from './commandes.component';

describe('CommandesComponent', () => {
  let component: CommandesComponent;
  let fixture: ComponentFixture<CommandesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommandesComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(CommandesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
